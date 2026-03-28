from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FeasibilityLineItemPayload(BaseModel):
    label: str
    unit_cost: float = Field(ge=0)
    quantity: int = Field(ge=1)

    @field_validator("label")
    @classmethod
    def label_nonempty(cls, v: str) -> str:
        t = v.strip()
        if not t:
            raise ValueError("Line item label is required")
        return t


class FeasibilityProjectCreate(BaseModel):
    name: str
    items: list[FeasibilityLineItemPayload] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class FeasibilityProjectPut(BaseModel):
    name: str
    items: list[FeasibilityLineItemPayload]

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class FeasibilityLineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    unit_cost: float
    quantity: int
    sort_order: int

    @field_validator("unit_cost", mode="before")
    @classmethod
    def decimal_to_float(cls, v: object) -> float:
        if isinstance(v, Decimal):
            return float(v)
        if isinstance(v, (int, float)):
            return float(v)
        return float(v)


class FeasibilityProjectResponse(BaseModel):
    id: int
    user_id: int
    name: str
    items: list[FeasibilityLineItemResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None
