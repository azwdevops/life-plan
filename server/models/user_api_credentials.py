"""User LLM API keys only; providers and model lists are static (see static_llm_providers).

Table: user_llm_api_keys (user_id, provider_slug, name, key_secret, expires_on).

Alembic: run your own revision to create this table and drop legacy tables if needed.
"""

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from core.database import Base


class UserLlmApiKey(Base):
    """Secret for a built-in provider (slug matches static_llm_providers)."""

    __tablename__ = "user_llm_api_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "provider_slug", "name", name="uq_user_llm_api_keys_user_provider_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_slug = Column(String(64), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    key_secret = Column(Text, nullable=False)
    expires_on = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
