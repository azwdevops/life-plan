"""Built-in LLM vendors and model ids (no DB).

Provider ids are stable for API + client localStorage. Keys are stored per user in
`user_llm_api_keys` (see models.user_api_credentials).

Model slugs are the strings sent to each vendor’s HTTP API (verify in vendor docs if a call fails).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class StaticLlmModel:
    slug: str
    name: str


@dataclass(frozen=True)
class StaticLlmProvider:
    id: int
    slug: str
    display_name: str
    models: tuple[StaticLlmModel, ...]


# Google: Gemini API via OpenAI-compatible surface (AI Studio / API key).
# https://ai.google.dev/gemini-api/docs/openai
GOOGLE_GEMINI_OPENAI_BASE: Final[str] = (
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
)


STATIC_LLM_PROVIDERS: tuple[StaticLlmProvider, ...] = (
    StaticLlmProvider(
        id=1,
        slug="google",
        display_name="Google (Gemini)",
        models=(
            StaticLlmModel("gemini-2.5-flash", "Gemini 2.5 Flash (free tier)"),
            StaticLlmModel("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite (free tier)"),
            StaticLlmModel("gemini-2.5-pro", "Gemini 2.5 Pro (free tier, stricter limits)"),
        ),
    ),
)

_STATIC_BY_ID: dict[int, StaticLlmProvider] = {p.id: p for p in STATIC_LLM_PROVIDERS}
_STATIC_BY_SLUG: dict[str, StaticLlmProvider] = {p.slug: p for p in STATIC_LLM_PROVIDERS}


def get_static_provider(provider_id: int) -> StaticLlmProvider | None:
    return _STATIC_BY_ID.get(provider_id)


def get_static_provider_by_slug(slug: str) -> StaticLlmProvider | None:
    return _STATIC_BY_SLUG.get((slug or "").strip().lower())


def is_allowed_model(provider_slug: str, model_slug: str) -> bool:
    p = get_static_provider_by_slug(provider_slug)
    if not p:
        return False
    return any(m.slug == model_slug for m in p.models)
