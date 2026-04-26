from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ApiKeyMasked(BaseModel):
    id: int
    provider_id: int
    name: str
    value_masked: str = Field(description="Never includes full secret")
    expires_on: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ApiProviderModelOut(BaseModel):
    id: int
    provider_id: int
    name: str
    slug: str = Field(description="Exact string for API requests (not derived from name)")
    created_at: datetime
    updated_at: Optional[datetime] = None


class ApiProviderOut(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    keys: list[ApiKeyMasked] = []
    models: list[ApiProviderModelOut] = []


class ApiProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class ApiProviderUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    value: str = Field(min_length=1, description="API key or token")
    expires_on: Optional[date] = None


class ApiKeyUpdate(BaseModel):
    """Partial update; omit a field to leave it unchanged. Send expires_on: null to clear."""

    name: Optional[str] = None
    value: Optional[str] = None
    expires_on: Optional[date] = None


class ApiProviderModelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(
        min_length=1,
        max_length=512,
        description="Exact model id for requests; entered manually, not slugified from name",
    )


class ApiProviderModelUpdate(BaseModel):
    """Partial update; omit fields to leave unchanged."""

    name: Optional[str] = None
    slug: Optional[str] = None
