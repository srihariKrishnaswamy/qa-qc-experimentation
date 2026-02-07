"""
FastAPI backend: POST /api/rules/extract accepts a PDF file and returns
the Rule Library (JSON) using ai_pipeline + Gemini.
"""

import logging
import sys
import tempfile
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Run from repo root so ai_pipeline is importable (or set PYTHONPATH to repo root)
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from dotenv import load_dotenv

# Load ai_pipeline .env so GEMINI_API_KEY is available
load_dotenv(_REPO_ROOT / "ai_pipeline" / ".env")
load_dotenv(_REPO_ROOT / ".env")

from ai_pipeline.pipeline import extract_rules_from_pdf

app = FastAPI(title="Rules API", description="Extract quality rules from spec PDFs via Gemini")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/rules/extract")
async def rules_extract(file: UploadFile = File(...)):
    """Accept a PDF file, run Gemini extraction, return Rule Library JSON."""
    if file.content_type and "pdf" not in file.content_type.lower():
        raise HTTPException(status_code=400, detail="File must be a PDF")
    suffix = Path(file.filename or "spec.pdf").suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(status_code=400, detail="File must have .pdf extension")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    filename = file.filename or "spec.pdf"
    logger.info("rules/extract: start filename=%s size=%d bytes", filename, len(contents))
    t0 = time.monotonic()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = Path(tmp.name)
    try:
        rules = extract_rules_from_pdf(tmp_path)
        elapsed = time.monotonic() - t0
        if isinstance(rules, list):
            n = len(rules)
            logger.info("rules/extract: done filename=%s rules_count=%d elapsed=%.1fs", filename, n, elapsed)
            if n > 0:
                first = rules[0]
                logger.info("rules/extract: first rule keys=%s", list(first.keys()) if isinstance(first, dict) else type(first))
        else:
            logger.info("rules/extract: done filename=%s rules_type=%s elapsed=%.1fs", filename, type(rules).__name__, elapsed)
            if isinstance(rules, dict):
                logger.info("rules/extract: rules dict keys=%s", list(rules.keys()))
                if "raw" in rules:
                    raw = rules["raw"]
                    raw_str = str(raw)
                    logger.info("rules/extract: rules.raw length=%d preview=%s", len(raw_str), raw_str[:200])
        return {"rules": rules}
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)
