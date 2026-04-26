"""User-scoped API providers, keys, and provider models.

Alembic: import models then `alembic revision --autogenerate -m "..."` (do not hand-edit old revisions).

Tables: user_api_providers, user_api_keys, user_api_provider_models.
"""

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class UserApiProvider(Base):
    """Named LLM/API vendor for a user (e.g. openai, openrouter)."""

    __tablename__ = "user_api_providers"
    __table_args__ = (
        UniqueConstraint("user_id", "normalized_name", name="uq_user_api_providers_user_normalized_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(128), nullable=False)
    normalized_name = Column(String(128), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    keys = relationship(
        "UserApiKey",
        back_populates="provider",
        cascade="all, delete-orphan",
    )
    api_models = relationship(
        "UserApiProviderModel",
        back_populates="provider",
        cascade="all, delete-orphan",
    )


class UserApiKey(Base):
    """One secret key under a provider, with optional expiry."""

    __tablename__ = "user_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(
        Integer,
        ForeignKey("user_api_providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(128), nullable=False)
    key_secret = Column(Text, nullable=False)
    expires_on = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    provider = relationship("UserApiProvider", back_populates="keys")


class UserApiProviderModel(Base):
    """A model id the user configures for API requests (name + exact request slug)."""

    __tablename__ = "user_api_provider_models"
    __table_args__ = (
        UniqueConstraint("provider_id", "slug", name="uq_user_api_provider_models_provider_slug"),
    )

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(
        Integer,
        ForeignKey("user_api_providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(128), nullable=False)
    slug = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    provider = relationship("UserApiProvider", back_populates="api_models")
