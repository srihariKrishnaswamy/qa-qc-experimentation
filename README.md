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

[Demo video](https://drive.google.com/file/d/1v852Hjrv7AKwJZZvKraBFteZFNoDb-Qd/view?usp=sharing)

[Specbook from the Demo](https://drive.google.com/drive/u/0/folders/1XijIGvKQj4JH0aS_OvErYa9SgH6UMrIg)

[Results from the Demo](https://drive.google.com/file/d/1Ed_VUCYxQ--MvYcIUKQ9ynK3dmJ3SfY9/view?usp=sharing)

Soon to come: analysis of generated rule exhaustiveness

## LLM Roadmap and Checklist

This plan maps directly to the current Gemini-based pipeline in
`amplify/functions/specbookProcessor/handler.py` and
`amplify/functions/specbookProcessor/specbook/ingestion.py`, and is ordered to
deliver fast wins while keeping model changes safe and measurable.

### Phase 0: Baseline + Instrumentation
- Define success metrics: extraction accuracy, latency, cost per PDF, and parse rate.
- Log inputs/outputs with model name, prompt version, and chunk metadata.
- Create a 20-50 item golden set of specbook chunks with expected rules.

### Phase 1: Improve Prompting
- Consolidate the rules prompt into a versioned template.
- Add explicit constraints on JSON schema and trade vocabulary.
- Add few-shot examples only where they improve golden set scores.

### Phase 2: Dedup LLM Layer
- Add input normalization + cache key strategy (prompt version + chunk hash).
- Choose dedup policy: exact match and optional semantic similarity.
- Track cache hit rate and latency savings.

### Phase 3: Model Cycling + Router
- Introduce a model router interface with adapter-based providers.
- Add A/B evaluation using the golden set for Gemini, Claude, Grok, and others.
- Implement fallback to a stable model on errors or invalid JSON.

### Phase 4: Add Specific Providers
- Grok: adapter + eval pass.
- Claude: adapter + eval pass.
- Gemini variants: flash/pro as available + eval pass.

### Phase 5: Consolidate
- Choose default model per task based on scorecard.
- Document routing rules and re-evaluation cadence.

### Execution Checklist
- [ ] Capture baseline metrics + define golden set.
- [ ] Inventory current prompts and unify into a versioned template.
- [ ] Add structured logging for model, prompt version, and chunk id.
- [ ] Implement dedup cache and measure hit rate.
- [ ] Build model router with adapters (Gemini, Claude, Grok, others).
- [ ] Run A/B evals and publish scorecard.
- [ ] Lock default routing rules and document decision.

### Baseline Notes (fill in)
- Golden set location: TBD
- Metrics to track: accuracy, latency, cost per PDF, parse success rate
- Current model: `gemini-flash-latest`

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
