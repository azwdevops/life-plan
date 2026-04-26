"""Replace {{name}} in a JSON string template, then parse to a request body dict."""

from __future__ import annotations

import json
import re
from typing import Any, Optional

# Allow optional spaces: {{ model_name }}; names are alnum, underscore, dot (not {{}} inside values)
_PLACEHOLDER = re.compile(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")

# Default OpenRouter POST /api/v1/chat/completions body; override per row in self_discovery_assessments.llm_request_body_template
DEFAULT_OPENROUTER_LLM_REQUEST_BODY_JSON_TEMPLATE = (
    "{\n"
    '  "model": {{model_name}},\n'
    '  "messages": {{messages}},\n'
    '  "max_tokens": {{max_tokens}}\n'
    "}"
)


def openrouter_chat_completions_variables(
    messages: list[dict[str, Any]],
    model: Optional[str],
    max_tokens: int,
    *,
    default_model: str = "arcee-ai/trinity-large-preview:free",
) -> dict[str, Any]:
    """Variables for {{foo}} substitution; includes model, messages, and common aliases for user text."""
    model_id = (model or "").strip() or default_model
    user_content = ""
    for m in reversed(messages):
        if str(m.get("role", "")).lower() == "user":
            user_content = str(m.get("content", ""))
            break
    system_content = ""
    for m in messages:
        if str(m.get("role", "")).lower() == "system":
            system_content = str(m.get("content", ""))
            break
    u = user_content
    return {
        "model": model_id,
        "model_name": model_id,
        "model_slug": model_id,
        "system_message": system_content,
        "system": system_content,
        "user_message": u,
        "prompt_content": u,
        "user": u,
        "user_prompt": u,
        "prompt": u,
        "max_tokens": int(max_tokens),
        "messages": messages,
    }


def _json_fragment(v: Any) -> str:
    if isinstance(v, str):
        return json.dumps(v)
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "null"
    if isinstance(v, int):
        return str(int(v))
    if isinstance(v, float):
        return json.dumps(v)
    if isinstance(v, (dict, list, tuple)):
        return json.dumps(v)
    return json.dumps(v)


def substitute_json_request_template(template: str, variables: dict[str, Any]) -> dict[str, Any]:
    """Replace each {{id}} in `template` and parse the result as a JSON object."""

    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        if key not in variables:
            known = ", ".join(sorted(variables))
            raise ValueError(
                f"Unknown placeholder '{{{{{key}}}}}' in LLM request body template. "
                f"Known variable names: {known}"
            )
        return _json_fragment(variables[key])

    out = _PLACEHOLDER.sub(repl, template)
    try:
        parsed: Any = json.loads(out)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM request body template is not valid JSON after substitution: {e}") from e
    if not isinstance(parsed, dict):
        raise ValueError("LLM request body template must be a JSON object at the top level after substitution")
    return parsed
