from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class DailyProductiveItemOut(BaseModel):
    id: str
    item_date: str
    text: str
    is_done: bool


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
