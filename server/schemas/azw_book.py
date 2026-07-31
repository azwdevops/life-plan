from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AzwBookCreate(BaseModel):
    title: str
    author_id: str
    summary: Optional[str] = None
    category_names: list[str] = []


class AzwBookUpdate(BaseModel):
    title: Optional[str] = None
    author_id: Optional[str] = None
    summary: Optional[str] = None
    category_names: Optional[list[str]] = None


class AzwBookOut(BaseModel):
    id: int
    title: str
    author_id: str
    author_name: str
    summary: Optional[str] = None
    category_names: list[str] = []
    chapter_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class AzwBookChapterCreate(BaseModel):
    """Title is auto-assigned server-side ("Chapter N") - not user-supplied."""

    content: str = ""


class AzwBookChapterUpdate(BaseModel):
    """Title/order_index are server-managed (auto-numbered, renumbered on delete) -
    not directly editable."""

    content: Optional[str] = None
    is_copied: Optional[bool] = None


class AzwBookChapterOut(BaseModel):
    id: int
    book_id: int
    title: str
    content: str
    order_index: int
    is_copied: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
