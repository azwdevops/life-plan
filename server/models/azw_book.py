"""AZW Books (books I'm writing/authoring, with chapters).

Reuses the shared `reading_authors`/`reading_categories` lookup tables (see
models/reading_library.py) for Author and Category instead of defining
duplicate ones here - see CLAUDE.md "Reuse shared lookup models".
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base

azw_book_categories = Table(
    "azw_book_categories",
    Base.metadata,
    Column(
        "book_id",
        Integer,
        ForeignKey("azw_books.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        String(36),
        ForeignKey("reading_categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class AzwBook(Base):
    __tablename__ = "azw_books"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id = Column(
        String(36), ForeignKey("reading_authors.id"), nullable=False, index=True
    )
    title = Column(String(512), nullable=False)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    author = relationship("ReadingAuthor")
    categories = relationship("ReadingCategory", secondary=azw_book_categories)
    chapters = relationship(
        "AzwBookChapter",
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="AzwBookChapter.order_index",
    )


class AzwBookChapter(Base):
    __tablename__ = "azw_book_chapters"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(
        Integer, ForeignKey("azw_books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(512), nullable=False)
    content = Column(Text, nullable=False, default="")
    order_index = Column(Integer, nullable=False, default=0)
    # True once the user has manually copied this chapter out of the app (e.g. into a
    # publishing tool); purely a personal progress marker, not derived from anything else.
    is_copied = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    book = relationship("AzwBook", back_populates="chapters")
