"""CLI: PDF → images → Gemini → print rules JSON."""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from processor import pdf_to_images

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


def main() -> None:
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    if not api_key:
        print("Error: GEMINI_API_KEY not set. Add it to .env or export it.", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Extract construction rules from a spec PDF.")
    parser.add_argument("--path", required=True, help="Path to the spec PDF")
    args = parser.parse_args()
    pdf_path = Path(args.path)

    print("Converting PDF to images...", file=sys.stderr)
    image_paths = pdf_to_images(pdf_path)
    print(f"Got {len(image_paths)} page(s). Sending all to Gemini in one request.", file=sys.stderr)

    prompt_part = types.Part.from_text(text=EXTRACTION_PROMPT)
    image_parts = [
        types.Part.from_bytes(data=p.read_bytes(), mime_type="image/jpeg")
        for p in image_paths
    ]
    contents = [prompt_part, *image_parts]

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=contents,
    )

    text = (response.text or "").strip()

    # If response looks like JSON, parse and pretty-print; otherwise print raw
    if text.startswith("{") or text.startswith("["):
        start = text.find("{") if "{" in text else text.find("[")
        end = text.rfind("}") + 1 if "}" in text else text.rfind("]") + 1
        if end > start:
            try:
                parsed = json.loads(text[start:end])
                print(json.dumps(parsed, indent=2))
            except json.JSONDecodeError:
                print(text)
        else:
            print(text)
    else:
        print(text)

    # Clean up temp dir (parent of first image path)
    if image_paths:
        tmp_dir = image_paths[0].parent
        if "ai_pipeline_pages_" in str(tmp_dir):
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except OSError:
                pass


if __name__ == "__main__":
    main()
