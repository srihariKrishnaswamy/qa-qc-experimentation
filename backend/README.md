# Rules API (FastAPI)

Extract quality rules from spec PDFs via the ai_pipeline (Gemini). The frontend calls `POST /api/rules/extract` with a PDF file and receives the Rule Library JSON.

## Setup

From the **repo root**:

1. Install ai_pipeline dependencies (Gemini, pdf2image, etc.):
   ```bash
   pip install -r ai_pipeline/requirements.txt
   ```
2. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Set `GEMINI_API_KEY` in `ai_pipeline/.env` (the backend loads that file).

## Run

Use the venv’s Python so `google-genai` is found (uvicorn’s reload subprocess must use the same env). From the **repo root**:

```bash
./backend/run.sh
```

Or activate the venv then uvicorn:

```bash
source backend/venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: `GET http://localhost:8000/api/health`
- Extract rules: `POST http://localhost:8000/api/rules/extract` with `file` (PDF) in form data.

## Frontend

In the frontend `.env.local`, set:

```
NEXT_PUBLIC_RULES_API_URL=http://localhost:8000
```

When this is set, the Upload Specbook flow uses the pipeline backend instead of the AWS ingest API.
