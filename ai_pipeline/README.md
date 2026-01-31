# AI Pipeline (local)

Local CLI that turns a construction spec PDF into a JSON list of rules using Gemini. It converts each page to an image, sends the images to Gemini with an extraction prompt, and prints the rules to the console.

## Prerequisites

- **Python 3.11+**
- **Poppler** (required by `pdf2image` to render PDFs):
  - macOS: `brew install poppler`
  - Ubuntu/Debian: `sudo apt-get install poppler-utils`

## Setup

1. **Create and activate a virtual environment** (from the repo root or from `ai_pipeline`):

   ```bash
   cd ai_pipeline
   python3 -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**

   Create a `.env` file in `ai_pipeline/` with your Gemini API key (and optionally the model):

   ```bash
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-2.0-flash
   ```

   Do not commit `.env`; it is listed in `.gitignore`.

## How to run

From the `ai_pipeline` directory with the venv activated:

```bash
python pipeline.py --path /path/to/your/spec.pdf
```

Example:

```bash
python pipeline.py --path ./my_spec.pdf
```

- Progress (PDF conversion, page count, “Sending to Gemini…”) is printed to **stderr**.
- The extracted rules JSON is printed to **stdout**.

To save the output to a file:

```bash
python pipeline.py --path ./my_spec.pdf > rules.json
```

## Files

- **`pipeline.py`** — CLI: parses `--path`, loads `.env`, calls the processor, sends images + prompt to Gemini, prints JSON. The extraction prompt (what to extract and how rules look) is at the top of this file.
- **`processor.py`** — Converts a PDF to a list of JPEG image paths (one per page) in a temp directory.
- **`requirements.txt`** — Python dependencies (`google-genai`, `pdf2image`, `python-dotenv`, etc.).

## Optional: test the processor only

To confirm PDF → images works without calling Gemini:

```bash
python processor.py /path/to/spec.pdf
```

This prints one path per page (e.g. `/var/.../ai_pipeline_pages_xxx/page_1.jpg`, …).
