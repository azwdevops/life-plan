from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ApiKeyMasked(BaseModel):
    id: int
    provider_id: int = Field(description="Static provider id (matches built-in catalog)")
    name: str
    value_masked: str = Field(description="Never includes full secret")
    expires_on: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ApiProviderModelOut(BaseModel):
    id: int = Field(description="Synthetic id for UI keys; use slug for API requests")
    provider_id: int
    name: str
    slug: str = Field(description="Model id sent to the vendor API")
    created_at: datetime
    updated_at: Optional[datetime] = None


class ApiProviderOut(BaseModel):
    id: int = Field(description="Static provider id")
    user_id: int
    name: str = Field(description="Display name from static catalog")
    created_at: datetime
    updated_at: Optional[datetime] = None
    keys: list[ApiKeyMasked] = []
    models: list[ApiProviderModelOut] = []


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    value: str = Field(min_length=1, description="API key or token")
    expires_on: Optional[date] = None


class ApiKeyUpdate(BaseModel):
    """Partial update; omit a field to leave it unchanged. Send expires_on: null to clear."""

    name: Optional[str] = None
    value: Optional[str] = None
    expires_on: Optional[date] = None
