import json

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from .common import (
    PROMPT_DEDUPE_PATH,
    PROMPT_RULES_PLACEHOLDER,
    PROMPT_TRADE_PLACEHOLDER,
    decode_rules_json,
    load_prompt_template,
    normalize_rules_for_trade,
    rules_from_payload,
    rules_to_dicts,
)


def build_dedupe_prompt(trade: str, rules: list[dict]) -> str:
    prompt_template = load_prompt_template(PROMPT_DEDUPE_PATH)
    rules_json = json.dumps({"rules": rules}, indent=2, sort_keys=True)
    return (
        prompt_template
        .replace(PROMPT_TRADE_PLACEHOLDER, trade)
        .replace(PROMPT_RULES_PLACEHOLDER, rules_json)
    )


def dedupe_grouped_rules(
    llm: ChatGoogleGenerativeAI,
    grouped_rules: dict[str, list[dict]],
) -> list[dict]:
    deduped_rules: list[dict] = []
    for trade, rules in grouped_rules.items():
        normalized_rules = normalize_rules_for_trade(trade, rules)
        if len(normalized_rules) <= 1:
            deduped_rules.extend(normalized_rules)
            continue

        prompt = build_dedupe_prompt(trade, normalized_rules)
        response = llm.invoke([HumanMessage(content=prompt)])
        payload = decode_rules_json(response.content)
        deduped = rules_from_payload(payload, source_chunk="multiple")
        deduped_rules.extend(rules_to_dicts(deduped))

    return deduped_rules
