# QA/QC Experimentation

This project is an AWS Amplify backend that ingests construction specbook PDFs
from S3, extracts trade-specific rules using a Gemini model, and writes grouped
rules JSON back to S3.

## What It Does Today

- Listens for S3 object-created events on the Amplify storage bucket.
- Downloads uploaded PDFs to the Lambda `/tmp` directory.
- Splits PDFs into overlapping chunks.
- Calls Gemini (via LangChain) to extract explicit, actionable rules per trade.
- Aggregates rules by trade and writes a single JSON file to `outputs/`.

## Architecture

- Amplify backend defined in `amplify/backend.ts`.
- S3 storage (`specbookUploads`) with two prefixes:
  - `uploads/*` for incoming PDFs.
  - `outputs/*` for generated rules JSON.
- Lambda function `specbookProcessor`:
  - Triggered by S3 `OBJECT_CREATED`.
  - Bundled Python 3.11 runtime with dependencies from
    `amplify/functions/specbookProcessor/requirements.txt`.

## Processing Flow

1. A PDF is uploaded under `uploads/`.
2. S3 triggers `specbookProcessor`.
3. The function:
   - downloads the PDF,
   - chunks it into 5-page windows with 1-page overlap,
   - calls Gemini in parallel for each chunk,
   - parses the JSON response,
   - groups rules by trade.
4. Outputs `{original_name}_rules.json` into `outputs/`.

## Output Format

The Lambda writes grouped rules as JSON:

```json
{
  "plumber": [
    {
      "rule_id": "P-001",
      "description": "Short, precise requirement",
      "requirements": ["Requirement 1", "Requirement 2"],
      "source_pages": [1, 2],
      "source_chunk": "specbook_chunk_1.pdf"
    }
  ]
}
```

## Demo

Demo video: _TBD_ (paste URL here when available).

## Configuration

The function reads environment variables:

- `GOOGLE_API_KEY` (required): Gemini API key.
- `GOOGLE_MODEL` (optional): defaults to `gemini-flash-latest`.
- `OUTPUT_PREFIX` (optional): defaults to `outputs/`.
- `UPLOAD_BUCKET_NAME` (optional fallback): used if no bucket name is in event.

Amplify also sets `UPLOAD_PREFIX` to `uploads/` for consistency, though the
handler relies on the S3 event data for the actual key.

## Local Development

Run the Amplify backend sandbox:

```
npm run amplify:sandbox
```

## Repo Structure (Key Files)

- `amplify/backend.ts`: backend wiring, event notifications, env vars.
- `amplify/storage/resource.ts`: S3 bucket and access rules.
- `amplify/functions/specbookProcessor/handler.py`: Lambda entry point.
- `amplify/functions/specbookProcessor/specbook/ingestion.py`: PDF chunking and
  rule extraction logic.
