from typing import List

from pydantic import BaseModel, Field


class PendingWorkCategoryOut(BaseModel):
    id: str
    name: str


class PendingWorkItemOut(BaseModel):
    id: str
    category_id: str
    title: str


class PendingWorkStoreOut(BaseModel):
    v: int = 1
    categories: List[PendingWorkCategoryOut] = Field(default_factory=list)
    items: List[PendingWorkItemOut] = Field(default_factory=list)


class PendingWorkCategoryCreate(BaseModel):
    name: str = Field(..., max_length=256)


class PendingWorkCategoryPatch(BaseModel):
    name: str = Field(..., max_length=256)


class PendingWorkItemCreate(BaseModel):
    category_id: str = Field(..., max_length=64)
    title: str = Field(..., max_length=512)


class PendingWorkItemPatch(BaseModel):
    title: str = Field(..., max_length=512)


class PendingWorkCategoryCreateResponse(BaseModel):
    category: PendingWorkCategoryOut
