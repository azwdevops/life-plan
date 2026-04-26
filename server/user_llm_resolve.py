"""Resolve saved user LLM API key + static provider + model (shared by game and ai_schedule)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from models.user_api_credentials import UserLlmApiKey
from static_llm_providers import get_static_provider, is_allowed_model


class UserLlmCredentialError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def resolve_saved_user_vendor_llm(
    db: Session,
    user_id: int,
    provider_id: int,
    key_id: int,
    model_slug: str,
) -> tuple[str, str, str]:
    """Return (api_key_secret, provider_slug, model_slug) after ownership and catalog checks."""
    slug = model_slug.strip()
    if not slug:
        raise UserLlmCredentialError("model (slug) is required when using saved credentials")
    sp = get_static_provider(provider_id)
    if not sp:
        raise UserLlmCredentialError("Provider not found", status_code=404)
    if not is_allowed_model(sp.slug, slug):
        raise UserLlmCredentialError("Model is not in the catalog for this provider")
    key_row = (
        db.query(UserLlmApiKey)
        .filter(
            UserLlmApiKey.id == key_id,
            UserLlmApiKey.user_id == user_id,
            UserLlmApiKey.provider_slug == sp.slug,
        )
        .first()
    )
    if not key_row:
        raise UserLlmCredentialError("API key not found", status_code=404)
    secret = (key_row.key_secret or "").strip()
    if not secret:
        raise UserLlmCredentialError("Stored API key is empty")
    return secret, sp.slug, slug
