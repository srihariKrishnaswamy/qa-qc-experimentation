"""
Validate LLM extraction output (JSON or plain text) using keywords from the
pipeline prompt. No AI—keyword and structure checks only.

With --pdf: extract every line from the PDF that contains keywords, then
check the LLM output for each; flag any PDF line not reflected in the output.
"""

import argparse
import json
import re
import sys
from pathlib import Path

import pdfplumber

# Default: validate the file pipeline.py writes (run from ai_pipeline or pass a path)
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT_FILE = SCRIPT_DIR / "output" / "rules.json"

# Keywords derived from pipeline EXTRACTION_PROMPT: quality rules, dimensions, shall
REQUIRED_KEYWORDS = ("shall", "dimension", "quality", "rule")
OPTIONAL_KEYWORDS = ("spec", "section", "page")
# Expected keys when output is JSON (dimension is optional in prompt: "if any")
REQUIRED_JSON_KEYS = ("rule", "source_page", "shall_statement")
OPTIONAL_JSON_KEYS = ("dimension",)


def _normalize(s: str) -> str:
    """Lowercase, collapse whitespace, strip — for matching."""
    return " ".join(re.split(r"\s+", (s or "").lower().strip()))


def _significant_words(s: str, min_len: int = 2) -> set[str]:
    """Words of min_len+ chars, digits allowed."""
    return set(re.findall(r"[a-z0-9]{" + str(min_len) + r",}", _normalize(s)))


def extract_keyword_lines_from_pdf(pdf_path: Path, keywords: tuple[str, ...]) -> list[tuple[str, int]]:
    """
    Extract every line from the PDF that contains any of the given keywords.
    Returns list of (line_text, page_number). Page numbers are 1-based.
    """
    keyword_set = {k.lower() for k in keywords}
    found: list[tuple[str, int]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text()
            if not text:
                continue
            for raw_line in text.split("\n"):
                line = raw_line.strip()
                if not line:
                    continue
                if any(kw in line.lower() for kw in keyword_set):
                    found.append((line, i))
    return found


def get_output_texts(raw: str) -> list[str]:
    """
    Get all searchable text strings from LLM output (for matching against PDF lines).
    If JSON array of rule objects, concatenate rule, dimension, shall_statement, source_page.
    Otherwise treat whole raw as one block and split into lines.
    """
    items = parse_as_json(raw)
    if items and isinstance(items, list):
        texts = []
        for item in items:
            if not isinstance(item, dict):
                continue
            for key in ("rule", "dimension", "shall_statement", "source_page"):
                val = item.get(key)
                if val is not None and str(val).strip():
                    texts.append(str(val).strip())
        return texts
    return [ln.strip() for ln in raw.splitlines() if ln.strip()]


def pdf_line_covered(pdf_line: str, output_texts: list[str]) -> bool:
    """
    True if the PDF line is reflected in the LLM output (lenient).
    Uses: substring of normalized text, or significant word overlap (≥40% of PDF line words).
    """
    norm_line = _normalize(pdf_line)
    if not norm_line:
        return True
    line_words = _significant_words(pdf_line)
    if not line_words:
        return True
    norm_output = " ".join(_normalize(t) for t in output_texts)
    # Substring: PDF line (or a substantial chunk) appears in output
    if norm_line in norm_output:
        return True
    # Or any output chunk contains the line
    for ot in output_texts:
        if norm_line in _normalize(ot):
            return True
        if _normalize(ot) in norm_line:
            return True
    # Word overlap: at least 40% of significant words from PDF line appear in output
    output_words = _significant_words(norm_output)
    overlap = len(line_words & output_words) / len(line_words)
    return overlap >= 0.4


def run_pdf_vs_output_validation(pdf_path: Path, output_raw: str, keywords: tuple[str, ...]) -> dict:
    """
    Extract keyword lines from PDF, compare to LLM output, return missing lines and summary.
    """
    pdf_lines = extract_keyword_lines_from_pdf(pdf_path, keywords)
    output_texts = get_output_texts(output_raw)
    missing: list[tuple[str, int]] = []
    for line, page in pdf_lines:
        if not pdf_line_covered(line, output_texts):
            missing.append((line, page))
    return {
        "pdf_keyword_lines": len(pdf_lines),
        "missing": missing,
        "passed": len(missing) == 0,
    }


def load_output(path: Path | None) -> str:
    """Read output from file or stdin."""
    if path is None or str(path) == "-":
        return sys.stdin.read()
    return path.read_text()


def parse_as_json(raw: str) -> list[dict] | None:
    """Try to parse as JSON array of objects. Returns None if not valid JSON or not array."""
    raw = raw.strip()
    start = raw.find("[")
    if start == -1:
        return None
    end = raw.rfind("]") + 1
    if end <= start:
        return None
    try:
        parsed = json.loads(raw[start:end])
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list):
        return None
    return parsed


def validate_json_structure(items: list[dict]) -> tuple[bool, list[str]]:
    """Check each item has required keys; be lenient on optional keys. Returns (ok, messages)."""
    messages = []
    all_ok = True
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            messages.append(f"Item {i}: not an object")
            all_ok = False
            continue
        missing = [k for k in REQUIRED_JSON_KEYS if k not in item]
        if missing:
            messages.append(f"Item {i}: missing keys {missing}")
            all_ok = False
    if not messages and not items:
        messages.append("No items in array")
        all_ok = False
    return all_ok, messages


def count_keywords_in_text(text: str, keywords: tuple[str, ...]) -> dict[str, int]:
    """Case-insensitive count of keyword occurrences in text."""
    lower = text.lower()
    return {kw: len(re.findall(re.escape(kw), lower)) for kw in keywords}


def validate_keywords(text: str, required: tuple[str, ...], min_total: int = 1) -> tuple[bool, list[str]]:
    """
    Require at least min_total occurrences across required keywords (overshoot: any signal counts).
    """
    counts = count_keywords_in_text(text, required)
    total = sum(counts.values())
    messages = [f"  {k}: {v}" for k, v in counts.items()]
    ok = total >= min_total
    return ok, messages


def validate_no_obvious_fail(text: str) -> tuple[bool, list[str]]:
    """Reject obvious LLM failures: apology, refusal, empty, or pure markdown with no data."""
    lower = text.strip().lower()
    if not lower:
        return False, ["Output is empty"]
    # Common refusal/apology phrases (overshoot: only clear cases)
    bad_phrases = (
        "i cannot",
        "i can't",
        "i'm unable",
        "i am unable",
        "as an ai",
        "i don't have",
        "i do not have",
    )
    for phrase in bad_phrases:
        if phrase in lower and "shall" not in lower[:200]:
            return False, [f"Output looks like refusal/apology (contains '{phrase}')"]
    return True, []


def run_validation(raw: str) -> dict:
    """
    Run all checks. Returns a dict with keys: json_used, passed, results (list of check results).
    """
    results = []

    # 1. Reject obvious failures
    ok, msgs = validate_no_obvious_fail(raw)
    results.append(("no_obvious_fail", ok, msgs))
    if not ok:
        return {"json_used": False, "passed": False, "results": results}

    # 2. Try JSON path
    items = parse_as_json(raw)
    json_used = items is not None

    if json_used and items is not None:
        ok, msgs = validate_json_structure(items)
        results.append(("json_structure", ok, msgs))
        # Use full text for keyword check (JSON stringified)
        text_for_keywords = json.dumps(items) if items else raw
    else:
        results.append(("json_structure", False, ["Output is not a JSON array (or parse failed)"]))
        text_for_keywords = raw

    # 3. Keyword check: at least one required keyword present (overshoot)
    ok, msgs = validate_keywords(text_for_keywords, REQUIRED_KEYWORDS, min_total=1)
    results.append(("required_keywords", ok, msgs))

    passed = all(r[1] for r in results)
    return {"json_used": json_used, "passed": passed, "results": results}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate pipeline LLM output. With --pdf, check every PDF keyword line is in the output."
    )
    parser.add_argument(
        "output",
        nargs="?",
        default=None,
        help=f"Path to rules file (LLM output), '-' for stdin, or omit to use {DEFAULT_OUTPUT_FILE.name}",
    )
    parser.add_argument(
        "--pdf",
        metavar="PATH",
        default=None,
        help="Path to spec PDF; then validation checks each keyword line from PDF appears in output",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Print all check results")
    args = parser.parse_args()

    if args.output is None:
        output_path = DEFAULT_OUTPUT_FILE
    elif args.output == "-":
        output_path = None
    else:
        output_path = Path(args.output)

    raw = load_output(output_path)

    if args.pdf:
        pdf_path = Path(args.pdf)
        if not pdf_path.exists():
            print(f"Error: PDF not found: {pdf_path}", file=sys.stderr)
            return 2
        result = run_pdf_vs_output_validation(pdf_path, raw, REQUIRED_KEYWORDS)
        total = result["pdf_keyword_lines"]
        missing = result["missing"]
        print(f"PDF keyword lines (shall/dimension/quality/rule): {total}")
        print(f"Missing from output (flagged): {len(missing)}")
        if missing:
            for line, page in missing:
                print(f"  [p{page}] {line[:100]}{'...' if len(line) > 100 else ''}")
            print("FAIL")
            return 1
        print("PASS")
        return 0

    out = run_validation(raw)
    if args.verbose:
        for name, ok, messages in out["results"]:
            status = "PASS" if ok else "FAIL"
            print(f"{name}: {status}")
            for m in messages:
                print(m)
    print("PASS" if out["passed"] else "FAIL")
    return 0 if out["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
