"""Backwards-compatible imports for specbook ingestion."""

from .common import Rule
from .rule_dedup import build_dedupe_prompt, dedupe_grouped_rules
from .rule_generation import (
    build_rules_prompt,
    chunk_pdf,
    extract_rules_for_chunks_parallel,
    generate_rules_json,
    group_rules_by_trade,
)

__all__ = [
    "Rule",
    "build_dedupe_prompt",
    "build_rules_prompt",
    "chunk_pdf",
    "dedupe_grouped_rules",
    "extract_rules_for_chunks_parallel",
    "generate_rules_json",
    "group_rules_by_trade",
]
