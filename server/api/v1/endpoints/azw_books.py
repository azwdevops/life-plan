"""AZW Books endpoints.

Author/Category are NOT defined here - they reuse the shared
`ReadingAuthor`/`ReadingCategory` models (models/reading_library.py) and their
granular CRUD lives on the reading-library router (`/reading-library/authors`,
`/reading-library/categories`). See CLAUDE.md "Reuse shared lookup models".
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.azw_book import AzwBook, AzwBookChapter
from models.reading_library import ReadingAuthor, ReadingCategory
from models.user import User
from schemas.azw_book import (
    AzwBookChapterCreate,
    AzwBookChapterOut,
    AzwBookChapterUpdate,
    AzwBookCreate,
    AzwBookOut,
    AzwBookUpdate,
)

router = APIRouter()


def _normalize_name(name: str) -> str:
    return name.strip()


def _get_or_create_category(db: Session, user_id: int, name: str) -> ReadingCategory | None:
    normalized = _normalize_name(name)
    if not normalized:
        return None
    existing = (
        db.query(ReadingCategory)
        .filter(
            ReadingCategory.user_id == user_id,
            func.lower(ReadingCategory.name) == normalized.lower(),
        )
        .first()
    )
    if existing:
        return existing
    row = ReadingCategory(id=str(uuid.uuid4()), user_id=user_id, name=normalized[:512])
    db.add(row)
    db.flush()
    return row


def _resolve_categories(db: Session, user_id: int, category_names: list[str]) -> list[ReadingCategory]:
    rows: list[ReadingCategory] = []
    seen: set[str] = set()
    for name in category_names:
        key = _normalize_name(name).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        row = _get_or_create_category(db, user_id, name)
        if row is not None:
            rows.append(row)
    return rows


def _book_to_out(row: AzwBook) -> AzwBookOut:
    return AzwBookOut(
        id=row.id,
        title=row.title,
        author_id=row.author_id,
        author_name=row.author.name if row.author else "",
        summary=row.summary,
        category_names=sorted([c.name for c in row.categories], key=lambda x: x.lower()),
        chapter_count=len(row.chapters),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_book_for_user(db: Session, user_id: int, book_id: int) -> AzwBook:
    row = (
        db.query(AzwBook)
        .options(selectinload(AzwBook.author), selectinload(AzwBook.categories), selectinload(AzwBook.chapters))
        .filter(AzwBook.id == book_id, AzwBook.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return row


def _get_chapter_for_user(db: Session, user_id: int, chapter_id: int) -> AzwBookChapter:
    row = (
        db.query(AzwBookChapter)
        .join(AzwBook, AzwBookChapter.book_id == AzwBook.id)
        .filter(AzwBookChapter.id == chapter_id, AzwBook.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return row


# --- Books ---


@router.get("/", response_model=list[AzwBookOut])
async def list_azw_books(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AzwBook)
        .options(
            selectinload(AzwBook.author),
            selectinload(AzwBook.categories),
            selectinload(AzwBook.chapters),
        )
        .filter(AzwBook.user_id == current_user.id)
        .order_by(AzwBook.created_at.desc())
        .all()
    )
    return [_book_to_out(row) for row in rows]


@router.post("/", response_model=AzwBookOut, status_code=status.HTTP_201_CREATED)
async def create_azw_book(
    body: AzwBookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")
    author = (
        db.query(ReadingAuthor)
        .filter(ReadingAuthor.id == body.author_id, ReadingAuthor.user_id == current_user.id)
        .first()
    )
    if not author:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")

    book = AzwBook(
        user_id=current_user.id,
        author_id=author.id,
        title=title[:512],
        summary=(body.summary or "").strip() or None,
    )
    book.categories = _resolve_categories(db, current_user.id, body.category_names)
    db.add(book)
    db.commit()
    return _book_to_out(_get_book_for_user(db, current_user.id, book.id))


@router.put("/{book_id}", response_model=AzwBookOut)
async def update_azw_book(
    book_id: int,
    body: AzwBookUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    book = _get_book_for_user(db, current_user.id, book_id)
    data = body.model_dump(exclude_unset=True)

    if "title" in data and data["title"] is not None:
        title = data["title"].strip()
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")
        book.title = title[:512]
    if "author_id" in data and data["author_id"] is not None:
        author = (
            db.query(ReadingAuthor)
            .filter(ReadingAuthor.id == data["author_id"], ReadingAuthor.user_id == current_user.id)
            .first()
        )
        if not author:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")
        book.author_id = author.id
    if "summary" in data:
        book.summary = (data["summary"] or "").strip() or None
    if "category_names" in data and data["category_names"] is not None:
        book.categories = _resolve_categories(db, current_user.id, data["category_names"])

    db.commit()
    return _book_to_out(_get_book_for_user(db, current_user.id, book.id))


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_azw_book(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    book = _get_book_for_user(db, current_user.id, book_id)
    db.delete(book)
    db.commit()
    return None


@router.get("/{book_id}", response_model=AzwBookOut)
async def get_azw_book(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _book_to_out(_get_book_for_user(db, current_user.id, book_id))


# --- Chapters ---


@router.get("/{book_id}/chapters", response_model=list[AzwBookChapterOut])
async def list_azw_book_chapters(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_book_for_user(db, current_user.id, book_id)
    return (
        db.query(AzwBookChapter)
        .filter(AzwBookChapter.book_id == book_id)
        .order_by(AzwBookChapter.order_index, AzwBookChapter.id)
        .all()
    )


@router.post(
    "/{book_id}/chapters",
    response_model=AzwBookChapterOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_azw_book_chapter(
    book_id: int,
    body: AzwBookChapterCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_book_for_user(db, current_user.id, book_id)

    max_order = (
        db.query(func.max(AzwBookChapter.order_index))
        .filter(AzwBookChapter.book_id == book_id)
        .scalar()
    )
    next_number = (max_order + 1) if max_order is not None else 1

    chapter = AzwBookChapter(
        book_id=book_id,
        title=f"Chapter {next_number}",
        content=body.content or "",
        order_index=next_number,
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


@router.put("/chapters/{chapter_id}", response_model=AzwBookChapterOut)
async def update_azw_book_chapter(
    chapter_id: int,
    body: AzwBookChapterUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chapter = _get_chapter_for_user(db, current_user.id, chapter_id)
    data = body.model_dump(exclude_unset=True)

    if "content" in data and data["content"] is not None:
        chapter.content = data["content"]
    if "is_copied" in data and data["is_copied"] is not None:
        chapter.is_copied = data["is_copied"]

    db.commit()
    db.refresh(chapter)
    return chapter


@router.delete("/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_azw_book_chapter(
    chapter_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chapter = _get_chapter_for_user(db, current_user.id, chapter_id)
    book_id = chapter.book_id
    deleted_number = chapter.order_index
    db.delete(chapter)
    db.flush()

    # Keep numbering contiguous: every chapter after the deleted one shifts down by 1,
    # and its auto title ("Chapter N") is renumbered to match.
    later_chapters = (
        db.query(AzwBookChapter)
        .filter(AzwBookChapter.book_id == book_id, AzwBookChapter.order_index > deleted_number)
        .order_by(AzwBookChapter.order_index)
        .all()
    )
    for later in later_chapters:
        later.order_index -= 1
        later.title = f"Chapter {later.order_index}"

    db.commit()
    return None
