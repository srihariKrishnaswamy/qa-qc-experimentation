import base64
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pypdf import PdfReader, PdfWriter


logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 5
DEFAULT_OVERLAP = 1
DEFAULT_MAX_RETRIES = 5
DEFAULT_MAX_CONCURRENCY = 4
PROMPT_TRADE_PLACEHOLDER = "{{TRADE_LIST}}"
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "rules_prompt.txt"
_PROMPT_TEMPLATE: str | None = None


@dataclass
class Rule:
    trade: str
    rule_id: str
    description: str
    requirements: list[str]
    source_pages: list[int]
    source_chunk: str


def _validate_chunk_params(chunk_size: int, overlap: int) -> None:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0:
        raise ValueError("overlap must be non-negative")
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")


def _load_prompt_template() -> str:
    global _PROMPT_TEMPLATE
    if _PROMPT_TEMPLATE is None:
        _PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")
    return _PROMPT_TEMPLATE


def chunk_pdf(
    input_pdf: str | Path,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
    output_dir: str | Path | None = None,
) -> list[Path]:
    input_path = Path(input_pdf)
    if not input_path.exists() or not input_path.is_file():
        raise FileNotFoundError(f"PDF not found: {input_path}")
    _validate_chunk_params(chunk_size, overlap)

    if output_dir is None:
        output_path = input_path.parent / f"{input_path.stem}_chunks"
    else:
        output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(input_path))
    total_pages = len(reader.pages)
    chunk_paths: list[Path] = []

    step = chunk_size - overlap
    for start in range(0, total_pages, step):
        writer = PdfWriter()
        end = min(start + chunk_size, total_pages)
        for page_index in range(start, end):
            writer.add_page(reader.pages[page_index])

        chunk_index = (start // step) + 1
        chunk_file = output_path / f"{input_path.stem}_chunk_{chunk_index}.pdf"
        with chunk_file.open("wb") as handle:
            writer.write(handle)
        chunk_paths.append(chunk_file)

    return chunk_paths


def build_rules_prompt(trades: list[str]) -> str:
    trade_list = ", ".join(trades)
    prompt_template = _load_prompt_template()
    return prompt_template.replace(PROMPT_TRADE_PLACEHOLDER, trade_list)


def _decode_rules_json(raw_text: str) -> dict:
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model response did not contain JSON object.")
    return json.loads(raw_text[start : end + 1])


def _rules_from_payload(payload: dict, source_chunk: str) -> list[Rule]:
    rules: list[Rule] = []
    for item in payload.get("rules", []):
        trade = str(item.get("trade", "")).strip()
        rules.append(
            Rule(
                trade=trade,
                rule_id=str(item["rule_id"]),
                description=str(item["description"]),
                requirements=[str(req) for req in item.get("requirements", [])],
                source_pages=[int(p) for p in item.get("source_pages", [])],
                source_chunk=str(item.get("source_chunk", source_chunk)),
            )
        )
    return rules


def _build_message(chunk_path: Path, trades: list[str]) -> list[HumanMessage]:
    prompt = build_rules_prompt(trades)
    pdf_bytes = chunk_path.read_bytes()
    encoded_pdf = base64.b64encode(pdf_bytes).decode("utf-8")
    return [
        HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {"type": "media", "mime_type": "application/pdf", "data": encoded_pdf},
            ]
        )
    ]


def extract_rules_for_chunks_parallel(
    llm: ChatGoogleGenerativeAI,
    chunk_paths: list[Path],
    trades: list[str],
    max_retries: int = DEFAULT_MAX_RETRIES,
    max_concurrency: int = DEFAULT_MAX_CONCURRENCY,
) -> list[list[Rule]]:
    if not chunk_paths:
        return []

    messages = [_build_message(chunk_path, trades) for chunk_path in chunk_paths]
    results: list[list[Rule] | None] = [None] * len(chunk_paths)
    remaining = list(range(len(chunk_paths)))

    for attempt in range(1, max_retries + 1):
        logger.info(
            "Parallel batch attempt %d/%d for %d chunks",
            attempt,
            max_retries,
            len(remaining),
        )
        batch_messages = [messages[i] for i in remaining]
        responses = llm.batch(batch_messages, config={"max_concurrency": max_concurrency})

        next_remaining: list[int] = []
        for idx, response in zip(remaining, responses):
            chunk_name = chunk_paths[idx].name
            try:
                payload = _decode_rules_json(response.content)
                results[idx] = _rules_from_payload(payload, chunk_name)
            except Exception as exc:
                logger.warning(
                    "Chunk %s: parse failed on attempt %d: %s",
                    chunk_name,
                    attempt,
                    exc,
                )
                next_remaining.append(idx)

        remaining = next_remaining
        if not remaining:
            break
        if attempt < max_retries:
            time.sleep(1.0 * attempt)

    if remaining:
        failed_chunks = ", ".join(chunk_paths[i].name for i in remaining)
        logger.warning("Proceeding with empty rules for failed chunks: %s", failed_chunks)

    return [rules or [] for rules in results]


def group_rules_by_trade(rules: list[Rule]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for rule in rules:
        grouped.setdefault(rule.trade or "unspecified", []).append(
            {
                "rule_id": rule.rule_id,
                "description": rule.description,
                "requirements": rule.requirements,
                "source_pages": rule.source_pages,
                "source_chunk": rule.source_chunk,
            }
        )
    return grouped


def generate_rules_json(
    input_pdf: str | Path,
    llm: ChatGoogleGenerativeAI,
    trades: list[str],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
    max_retries: int = DEFAULT_MAX_RETRIES,
    max_concurrency: int = DEFAULT_MAX_CONCURRENCY,
) -> dict[str, list[dict]]:
    chunk_paths = chunk_pdf(input_pdf, chunk_size=chunk_size, overlap=overlap)
    rules_per_chunk = extract_rules_for_chunks_parallel(
        llm,
        chunk_paths,
        trades,
        max_retries=max_retries,
        max_concurrency=max_concurrency,
    )

    all_rules = [rule for rules in rules_per_chunk for rule in rules]
    return group_rules_by_trade(all_rules)
