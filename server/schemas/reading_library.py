from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

ShelfLiteral = Literal["want", "reading", "read"]


class ReadingAuthorPayload(BaseModel):
    id: str = Field(max_length=64)
    name: str = Field(max_length=512)


class ReadingCategoryPayload(BaseModel):
    id: str = Field(max_length=64)
    name: str = Field(max_length=512)


class ReadingBookPayload(BaseModel):
    id: str = Field(max_length=64)
    title: str = Field(max_length=1024)
    author_id: str = Field(max_length=64)
    shelf: ShelfLiteral
    progress_percent: int = Field(ge=0, le=100)
    category_ids: List[str] = Field(default_factory=list)
    rating: Optional[int] = None
    started_at: Optional[date] = None
    finished_at: Optional[date] = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v < 1 or v > 5:
            raise ValueError("rating must be between 1 and 5")
        return v


class ReadingLibraryPayload(BaseModel):
    authors: List[ReadingAuthorPayload]
    categories: List[ReadingCategoryPayload]
    books: List[ReadingBookPayload]


class ReadingAuthorOut(BaseModel):
    id: str
    name: str


class ReadingCategoryOut(BaseModel):
    id: str
    name: str


class ReadingBookOut(BaseModel):
    id: str
    title: str
    author_id: str
    shelf: ShelfLiteral
    progress_percent: int
    category_ids: List[str]
    rating: Optional[int] = None
    started_at: Optional[date] = None
    finished_at: Optional[date] = None


class ReadingLibraryOut(BaseModel):
    authors: List[ReadingAuthorOut]
    categories: List[ReadingCategoryOut]
    books: List[ReadingBookOut]
