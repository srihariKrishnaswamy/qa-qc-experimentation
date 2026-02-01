import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DEFAULT_CHUNK_SIZE = 5
DEFAULT_OVERLAP = 1
DEFAULT_MAX_RETRIES = 5
DEFAULT_MAX_CONCURRENCY = 4
PROMPT_TRADE_LIST_PLACEHOLDER = "{{TRADE_LIST}}"
PROMPT_TRADE_PLACEHOLDER = "{{TRADE}}"
PROMPT_RULES_PLACEHOLDER = "{{RULES_JSON}}"
PROMPT_RULES_PATH = Path(__file__).resolve().parent / "prompts" / "rules_prompt.txt"
PROMPT_DEDUPE_PATH = Path(__file__).resolve().parent / "prompts" / "rules_dedupe_prompt.txt"
_PROMPT_CACHE: dict[Path, str] = {}


@dataclass
class Rule:
    trade: str
    rule_id: str
    description: str
    requirements: list[str]
    source_pages: list[int]
    source_chunk: str


def load_prompt_template(path: Path) -> str:
    cached = _PROMPT_CACHE.get(path)
    if cached is None:
        cached = path.read_text(encoding="utf-8")
        _PROMPT_CACHE[path] = cached
    return cached


def coerce_response_text(raw_content: Any) -> str:
    if isinstance(raw_content, str):
        return raw_content
    if isinstance(raw_content, list):
        parts: list[str] = []
        for item in raw_content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        if parts:
            return "\n".join(parts)
        return json.dumps(raw_content)


def decode_rules_json(raw_text: str | Any) -> dict:
    text = coerce_response_text(raw_text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model response did not contain JSON object.")
    return json.loads(text[start : end + 1])


def rules_from_payload(payload: dict, source_chunk: str) -> list[Rule]:
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


def rules_to_dicts(rules: list[Rule]) -> list[dict]:
    return [
        {
            "trade": rule.trade,
            "rule_id": rule.rule_id,
            "description": rule.description,
            "requirements": rule.requirements,
            "source_pages": rule.source_pages,
            "source_chunk": rule.source_chunk,
        }
        for rule in rules
    ]


def normalize_rules_for_trade(trade: str, rules: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for rule in rules:
        normalized.append(
            {
                "trade": trade,
                "rule_id": str(rule.get("rule_id", "")).strip(),
                "description": str(rule.get("description", "")).strip(),
                "requirements": [str(req) for req in rule.get("requirements", [])],
                "source_pages": [int(p) for p in rule.get("source_pages", [])],
                "source_chunk": str(rule.get("source_chunk", "")),
            }
        )
    return normalized
