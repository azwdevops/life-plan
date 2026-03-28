from sqlalchemy import Column, Date, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship

from core.database import Base

reading_book_categories = Table(
    "reading_book_categories",
    Base.metadata,
    Column(
        "book_id",
        String(36),
        ForeignKey("reading_books.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        String(36),
        ForeignKey("reading_categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class ReadingAuthor(Base):
    __tablename__ = "reading_authors"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(512), nullable=False)

    books = relationship("ReadingBook", back_populates="author")


class ReadingCategory(Base):
    __tablename__ = "reading_categories"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(512), nullable=False)

    books = relationship(
        "ReadingBook",
        secondary=reading_book_categories,
        back_populates="categories",
    )


class ReadingBook(Base):
    __tablename__ = "reading_books"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(
        String(36),
        ForeignKey("reading_authors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title = Column(String(1024), nullable=False)
    shelf = Column(String(16), nullable=False)
    progress_percent = Column(Integer, nullable=False, default=0)
    rating = Column(Integer, nullable=True)
    started_at = Column(Date, nullable=True)
    finished_at = Column(Date, nullable=True)

    author = relationship("ReadingAuthor", back_populates="books")
    categories = relationship(
        "ReadingCategory",
        secondary=reading_book_categories,
        back_populates="books",
    )
