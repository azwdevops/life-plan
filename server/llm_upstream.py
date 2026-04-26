"""Call vendor chat APIs from static provider slug + API key + model."""

from __future__ import annotations

import json
from typing import Any

import httpx

from static_llm_providers import GOOGLE_GEMINI_OPENAI_BASE


class LlmUpstreamError(RuntimeError):
    pass


def _flatten_openai_message_content(content: Any) -> str:
    """Normalize OpenAI-style message.content (str or list of typed parts) to plain text."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                t = block.get("text")
                if isinstance(t, str):
                    parts.append(t)
                elif block.get("type") == "text" and isinstance(block.get("content"), str):
                    parts.append(block["content"])
        return "".join(parts).strip()
    return ""


def _text_from_openai_chat_completion_json(data: Any) -> str:
    """Extract assistant text from a chat.completions-style JSON body (OpenAI + Gemini compat)."""
    if isinstance(data, list):
        if data and isinstance(data[0], dict) and "error" in data[0]:
            err = data[0]["error"]
            if isinstance(err, dict):
                msg = err.get("message") or str(err)
            else:
                msg = str(err)
            raise LlmUpstreamError(msg)
        raise LlmUpstreamError(f"Unexpected JSON array from upstream: {json.dumps(data)[:400]}")
    if not isinstance(data, dict):
        raise LlmUpstreamError("Upstream response is not a JSON object")
    if "error" in data:
        err = data["error"]
        if isinstance(err, dict):
            msg = err.get("message") or str(err)
        else:
            msg = str(err)
        raise LlmUpstreamError(msg)
    choices = data.get("choices")
    if not choices or not isinstance(choices, list):
        raise LlmUpstreamError("Upstream response missing choices")
    ch0 = choices[0]
    if not isinstance(ch0, dict):
        raise LlmUpstreamError("Upstream choices[0] has invalid shape")
    msg = ch0.get("message")
    if isinstance(msg, dict):
        text = _flatten_openai_message_content(msg.get("content"))
        if text:
            return text
    text = _flatten_openai_message_content(ch0.get("content"))
    if text:
        return text
    fr = ch0.get("finish_reason")
    raise LlmUpstreamError(
        "Upstream response missing assistant text (expected choices[0].message.content or choices[0].content). "
        f"finish_reason={fr!r}"
    )


def _openai_style_chat(
    url: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    max_tokens: int,
    extra_json: dict[str, Any] | None = None,
) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
    }
    if extra_json:
        body.update(extra_json)
    with httpx.Client(timeout=120.0) as client:
        r = client.post(url, headers=headers, json=body)
    if r.status_code >= 400:
        raise LlmUpstreamError(
            f"Upstream HTTP {r.status_code}: {r.text[:800] if r.text else ''}"
        )
    try:
        data = r.json()
    except json.JSONDecodeError as e:
        raise LlmUpstreamError(f"Upstream returned non-JSON body: {e}") from e
    return _text_from_openai_chat_completion_json(data)


def _google_openai_extra(model: str) -> dict[str, Any] | None:
    """Tune Gemini OpenAI-compat so JSON tasks keep tokens for visible output, not only thinking."""
    m = (model or "").lower()
    # 2.5 Pro / Gemini 3: thinking cannot be disabled; keep it low to leave room for completion text.
    if "gemini-2.5-pro" in m or "gemini-3" in m:
        return {"reasoning_effort": "low"}
    # 2.5 Flash / Flash-Lite / older 2.x: thinking may be disabled so output is not swallowed by thoughts.
    if "gemini-2.5" in m or "gemini-2" in m:
        return {"reasoning_effort": "none"}
    return None


def chat_completion_text(
    *,
    provider_slug: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    max_tokens: int,
) -> str:
    slug = (provider_slug or "").strip().lower()
    if slug == "google":
        return _openai_style_chat(
            GOOGLE_GEMINI_OPENAI_BASE,
            api_key,
            model,
            messages,
            max_tokens,
            extra_json=_google_openai_extra(model),
        )
    raise LlmUpstreamError(f"Unknown provider slug: {provider_slug!r}")
