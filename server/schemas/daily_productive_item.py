from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


def _validate_days(days: List[str]) -> List[str]:
    invalid = sorted(set(days) - VALID_DAYS)
    if invalid:
        raise ValueError(f"Invalid day(s): {', '.join(invalid)}")
    return days


class DailyProductiveItemOut(BaseModel):
    id: str
    item_date: str
    text: str
    is_done: bool
    template_id: Optional[int] = None


class DailyProductiveItemListOut(BaseModel):
    item_date: str
    editable: bool
    items: List[DailyProductiveItemOut] = Field(default_factory=list)


class DailyProductiveItemCreate(BaseModel):
    item_date: str
    text: str = Field(..., max_length=500)


class DailyProductiveItemReorder(BaseModel):
    item_date: str
    ordered_ids: List[str]


class DailyProductiveItemPatch(BaseModel):
    text: Optional[str] = Field(default=None, max_length=500)
    is_done: Optional[bool] = None
    item_date: Optional[str] = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "DailyProductiveItemPatch":
        if self.text is None and self.is_done is None and self.item_date is None:
            raise ValueError("At least one of text, is_done, or item_date is required")
        return self


class DailyProductiveTemplateOut(BaseModel):
    id: int
    text: str
    days: List[str]


class DailyProductiveTemplateCreate(BaseModel):
    text: str = Field(..., max_length=500)
    days: List[str] = Field(..., min_length=1)

    @field_validator("days")
    @classmethod
    def validate_days(cls, v: List[str]) -> List[str]:
        return _validate_days(v)


class DailyProductiveTemplatePatch(BaseModel):
    text: Optional[str] = Field(default=None, max_length=500)
    days: Optional[List[str]] = None

    @field_validator("days")
    @classmethod
    def validate_days(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return _validate_days(v) if v is not None else v

    @model_validator(mode="after")
    def at_least_one_field(self) -> "DailyProductiveTemplatePatch":
        if self.text is None and self.days is None:
            raise ValueError("At least one of text or days is required")
        return self
