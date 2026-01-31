import json
import logging
import os
from pathlib import Path
from typing import Any
from urllib.parse import unquote_plus

import boto3
from langchain_google_genai import ChatGoogleGenerativeAI

from specbook.ingestion import generate_rules_json


logger = logging.getLogger()
logger.setLevel(logging.INFO)

TRADES = [
    "carpenter",
    "drywall",
    "electrician",
    "hvac",
    "insulator",
    "painter",
    "plumber",
    "roofer",
    "steel",
    "tiler",
]


def _get_env(name: str, default: str = "") -> str:
    value = os.environ.get(name, default)
    if not value:
        raise ValueError(f"Missing required env var: {name}")
    return value


def _get_bucket_name(record: dict[str, Any]) -> str:
    bucket_name = (
        record.get("s3", {})
        .get("bucket", {})
        .get("name", "")
    )
    return bucket_name or os.environ.get("UPLOAD_BUCKET_NAME", "")


def _get_object_key(record: dict[str, Any]) -> str:
    key = (
        record.get("s3", {})
        .get("object", {})
        .get("key", "")
    )
    if not key:
        return ""
    return unquote_plus(key)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    logger.info("Received event:\n%s", json.dumps(event, indent=2, sort_keys=True))

    output_prefix = os.environ.get("OUTPUT_PREFIX", "outputs/")
    google_api_key = _get_env("GOOGLE_API_KEY")
    model_name = os.environ.get("GOOGLE_MODEL", "gemini-flash-latest")
    logger.info(
        "GOOGLE_API_KEY loaded (set=%s)",
        bool(google_api_key),
    )

    s3 = boto3.client("s3")
    llm = ChatGoogleGenerativeAI(model=model_name, google_api_key=google_api_key)

    records = event.get("Records", [])
    processed: list[str] = []

    for record in records:
        bucket_name = _get_bucket_name(record)
        if not bucket_name:
            raise ValueError("Missing bucket name in S3 event or env var")

        key = _get_object_key(record)
        if not key:
            logger.warning("Skipping record without S3 object key")
            continue

        local_pdf = Path("/tmp") / Path(key).name
        s3.download_file(bucket_name, key, str(local_pdf))

        grouped = generate_rules_json(local_pdf, llm, TRADES)

        output_name = f"{Path(key).stem}_rules.json"
        output_key = f"{output_prefix.rstrip('/')}/{output_name}"
        output_path = Path("/tmp") / output_name
        output_path.write_text(json.dumps(grouped, indent=2))
        s3.upload_file(str(output_path), bucket_name, output_key)

        processed.append(output_key)

    return {"statusCode": 200, "body": json.dumps({"processed": processed})}
