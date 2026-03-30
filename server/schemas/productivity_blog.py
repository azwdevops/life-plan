from typing import List

from pydantic import BaseModel, Field


class ProductivityBlogCategoryCreate(BaseModel):
    name: str = Field(..., max_length=256)


class ProductivityBlogCategoryOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ProductivityBlogPostCreate(BaseModel):
    id: str = Field(..., max_length=64)
    title: str = Field(default="Untitled", max_length=512)
    body_html: str = ""
    category_names: List[str] = Field(default_factory=list)


class ProductivityBlogPostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=512)
    body_html: str | None = None
    category_names: List[str] | None = None


class ProductivityBlogPostOut(BaseModel):
    id: str
    title: str
    body_html: str
    category_names: List[str] = Field(default_factory=list)


class ProductivityBlogDataOut(BaseModel):
    categories: List[ProductivityBlogCategoryOut] = Field(default_factory=list)
    posts: List[ProductivityBlogPostOut] = Field(default_factory=list)
