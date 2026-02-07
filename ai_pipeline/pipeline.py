"""CLI: PDF → images → Gemini → rules JSON (stdout + output folder)."""

import argparse
import json
import logging
import os
import shutil
import sys
import time
from pathlib import Path

logger = logging.getLogger(__name__)

from dotenv import load_dotenv
from google import genai
from google.genai import types

try:
    from .processor import pdf_to_images
except ImportError:
    from processor import pdf_to_images

# Output folder under ai_pipeline; validation.py can run against files here
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
DEFAULT_OUTPUT_FILENAME = "rules.json"

# -----------------------------------------------------------------------------
# PROMPT: This is where you tell Gemini what to extract and how the rules
# should look. Edit this string to change the output format (fields, wording).
# -----------------------------------------------------------------------------
EXTRACTION_PROMPT = (
    "You are a Senior Construction Manager. Look at these spec book pages (images) "
    "and extract any quality rules, dimensions, or 'shall' statements into a JSON list. "
    "Return ONLY valid JSON: an array of objects. Each object must have these fields: "
    "'rule' (short description), 'dimension' (if any), "
    "'source_page' (the exact page/section NUMBER as shown on the page—e.g. from the footer or "
    "corner, often in a format like '00 72 13 - 1' or similar section-based identifier; use that "
    "exact value as a string; do NOT use the word 'specifications' or a sequential 1,2,3...), "
    "'shall_statement' (exact or paraphrased 'shall' text). "
    "Do not include any text outside the JSON."
)

# --- Batch mode (commented out): set BATCH_SIZE to a positive int to send
#     pages in chunks instead of all at once (helps with quota/rate limits).
# BATCH_SIZE = 10   # pages per request when batching
# DELAY_BETWEEN_BATCHES = 2


def extract_rules_from_pdf(
    pdf_path: Path,
    *,
    api_key: str | None = None,
    model: str | None = None,
) -> list[dict] | dict:
    """
    Extract rules from a spec PDF using Gemini. Used by CLI and by the FastAPI backend.
    Returns parsed JSON (list of rule objects or dict). Raises on missing API key or runtime errors.
    """
    load_dotenv()
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY not set. Add it to .env or pass api_key=.")
    model_name = model or os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    t0 = time.monotonic()
    logger.info("Converting PDF to images...")
    image_paths = pdf_to_images(path)
    logger.info("Got %d page(s) in %.1fs. Sending to Gemini (%s)...", len(image_paths), time.monotonic() - t0, model_name)
    t1 = time.monotonic()

    try:
        prompt_part = types.Part.from_text(text=EXTRACTION_PROMPT)
        image_parts = [
            types.Part.from_bytes(data=p.read_bytes(), mime_type="image/jpeg")
            for p in image_paths
        ]
        contents = [prompt_part, *image_parts]
        client = genai.Client(api_key=key)
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
        )
        text = (response.text or "").strip()
        logger.info("Gemini responded in %.1fs", time.monotonic() - t1)
    finally:
        if image_paths:
            tmp_dir = image_paths[0].parent
            if "ai_pipeline_pages_" in str(tmp_dir):
                try:
                    shutil.rmtree(tmp_dir, ignore_errors=True)
                except OSError:
                    pass

    # Strip markdown code fence if present (e.g. ```json\n[...]\n```)
    stripped = text.strip()
    if stripped.startswith("```"):
        after_open = stripped.split("\n", 1)[1] if "\n" in stripped else ""
        if after_open.rstrip().endswith("```"):
            after_open = after_open.rsplit("```", 1)[0].rstrip()
        stripped = after_open

    if stripped.startswith("{") or stripped.startswith("["):
        start = stripped.find("{") if "{" in stripped else stripped.find("[")
        end = stripped.rfind("}") + 1 if "}" in stripped else stripped.rfind("]") + 1
        if end > start:
            try:
                return json.loads(stripped[start:end])
            except json.JSONDecodeError:
                pass
    return {"raw": text}


def main() -> None:
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    if not api_key:
        print("Error: GEMINI_API_KEY not set. Add it to .env or export it.", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Extract construction rules from a spec PDF.")
    parser.add_argument("--path", required=True, help="Path to the spec PDF")
    parser.add_argument("--out", default=None, help=f"Output filename under {OUTPUT_DIR.name}/ (default: {DEFAULT_OUTPUT_FILENAME})")
    args = parser.parse_args()
    pdf_path = Path(args.path)

    print("Converting PDF to images...", file=sys.stderr)
    rules = extract_rules_from_pdf(pdf_path, api_key=api_key, model=model)
    out_content = json.dumps(rules, indent=2)
    out_ext = ".json"

    # Write to output folder (for validation.py and reuse)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_name = args.out or DEFAULT_OUTPUT_FILENAME
    if not out_name.endswith(".json") and not out_name.endswith(".txt"):
        out_name = out_name.rstrip(".") + out_ext
    out_path = OUTPUT_DIR / out_name
    out_path.write_text(out_content, encoding="utf-8")
    print(f"Wrote rules to {out_path}", file=sys.stderr)

    print(out_content)


if __name__ == "__main__":
    main()
