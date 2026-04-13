from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class DisciplineCategoryOut(BaseModel):
    id: str
    label: str
    count: int


class DisciplineStoreOut(BaseModel):
    v: int = 1
    categories: List[DisciplineCategoryOut] = Field(default_factory=list)


class DisciplineCategoryCreate(BaseModel):
    label: str = Field(..., max_length=256)


class DisciplineCategoryPatch(BaseModel):
    label: Optional[str] = Field(default=None, max_length=256)
    count: Optional[int] = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "DisciplineCategoryPatch":
        if self.label is None and self.count is None:
            raise ValueError("At least one of label or count is required")
        return self
