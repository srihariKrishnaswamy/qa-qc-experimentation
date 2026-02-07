#!/usr/bin/env bash
# Run the backend using the venv Python so google-genai is available.
# From repo root: ./backend/run.sh
# Or from backend/: ./run.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_PYTHON="$SCRIPT_DIR/venv/bin/python"
if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Create the venv first: python -m venv backend/venv && pip install -r backend/requirements.txt"
  exit 1
fi
cd "$REPO_ROOT"
exec "$VENV_PYTHON" -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
