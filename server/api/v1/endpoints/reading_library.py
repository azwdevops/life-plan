import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.reading_library import (
    ReadingAuthor as ReadingAuthorModel,
    ReadingBook as ReadingBookModel,
    ReadingCategory as ReadingCategoryModel,
)
from models.user import User
from schemas.reading_library import (
    ReadingAuthorCreate,
    ReadingAuthorOut,
    ReadingBookOut,
    ReadingCategoryCreate,
    ReadingCategoryOut,
    ReadingLibraryOut,
    ReadingLibraryPayload,
)

router = APIRouter()


def _normalize_name(name: str) -> str:
    return name.strip()


# --- Granular author/category endpoints ---
#
# ReadingAuthor/ReadingCategory are shared lookup models: any feature that needs
# an "author" or "category" picker (reading tracking, AZW books, ...) reuses
# these same tables via these endpoints instead of defining its own. See
# CLAUDE.md "Reuse shared lookup models" for the reasoning.
#
# These sit alongside the bulk GET/PUT "/`" endpoints below (which the reading
# tracker uses to sync its whole local-first library in one shot) — both read
# and write the same `reading_authors`/`reading_categories` tables, so an
# author/category created through either path is visible to both.


@router.get("/authors", response_model=list[ReadingAuthorOut])
async def list_reading_authors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ReadingAuthorModel)
        .filter(ReadingAuthorModel.user_id == current_user.id)
        .order_by(ReadingAuthorModel.name)
        .all()
    )


@router.post("/authors", response_model=ReadingAuthorOut, status_code=status.HTTP_201_CREATED)
async def create_reading_author(
    body: ReadingAuthorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = _normalize_name(body.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Author name is required")
    existing = (
        db.query(ReadingAuthorModel)
        .filter(
            ReadingAuthorModel.user_id == current_user.id,
            func.lower(ReadingAuthorModel.name) == name.lower(),
        )
        .first()
    )
    if existing:
        return existing
    author = ReadingAuthorModel(id=str(uuid.uuid4()), user_id=current_user.id, name=name[:512])
    db.add(author)
    db.commit()
    db.refresh(author)
    return author


@router.get("/categories", response_model=list[ReadingCategoryOut])
async def list_reading_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ReadingCategoryModel)
        .filter(ReadingCategoryModel.user_id == current_user.id)
        .order_by(ReadingCategoryModel.name)
        .all()
    )


@router.post("/categories", response_model=ReadingCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_reading_category(
    body: ReadingCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = _normalize_name(body.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required")
    existing = (
        db.query(ReadingCategoryModel)
        .filter(
            ReadingCategoryModel.user_id == current_user.id,
            func.lower(ReadingCategoryModel.name) == name.lower(),
        )
        .first()
    )
    if existing:
        return existing
    category = ReadingCategoryModel(id=str(uuid.uuid4()), user_id=current_user.id, name=name[:512])
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def _library_to_out(db: Session, user_id: int) -> ReadingLibraryOut:
    authors = (
        db.query(ReadingAuthorModel)
        .filter(ReadingAuthorModel.user_id == user_id)
        .order_by(ReadingAuthorModel.name)
        .all()
    )
    categories = (
        db.query(ReadingCategoryModel)
        .filter(ReadingCategoryModel.user_id == user_id)
        .order_by(ReadingCategoryModel.name)
        .all()
    )
    books = (
        db.query(ReadingBookModel)
        .filter(ReadingBookModel.user_id == user_id)
        .order_by(ReadingBookModel.title)
        .all()
    )
    return ReadingLibraryOut(
        authors=[ReadingAuthorOut(id=a.id, name=a.name) for a in authors],
        categories=[ReadingCategoryOut(id=c.id, name=c.name) for c in categories],
        books=[
            ReadingBookOut(
                id=b.id,
                title=b.title,
                author_id=b.author_id,
                shelf=b.shelf,  # type: ignore[arg-type]
                progress_percent=b.progress_percent,
                category_ids=[c.id for c in b.categories],
                rating=b.rating,
                started_at=b.started_at,
                finished_at=b.finished_at,
            )
            for b in books
        ],
    )


def _validate_payload(body: ReadingLibraryPayload) -> None:
    author_ids = {a.id for a in body.authors}
    category_ids = {c.id for c in body.categories}
    for book in body.books:
        if book.author_id not in author_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Book {book.id!r} references unknown author_id {book.author_id!r}",
            )
        unknown = [cid for cid in book.category_ids if cid not in category_ids]
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Book {book.id!r} references unknown category_ids: {unknown}",
            )


@router.get("/", response_model=ReadingLibraryOut)
async def get_reading_library(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _library_to_out(db, current_user.id)


@router.put("/", response_model=ReadingLibraryOut)
async def put_reading_library(
    body: ReadingLibraryPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_payload(body)

    uid = current_user.id
    db.query(ReadingBookModel).filter(ReadingBookModel.user_id == uid).delete(
        synchronize_session=False
    )
    db.query(ReadingAuthorModel).filter(ReadingAuthorModel.user_id == uid).delete(
        synchronize_session=False
    )
    db.query(ReadingCategoryModel).filter(ReadingCategoryModel.user_id == uid).delete(
        synchronize_session=False
    )
    db.flush()

    for a in body.authors:
        db.add(ReadingAuthorModel(id=a.id[:64], user_id=uid, name=a.name[:512]))
    for c in body.categories:
        db.add(ReadingCategoryModel(id=c.id[:64], user_id=uid, name=c.name[:512]))

    db.flush()
    cat_map = {
        row.id: row
        for row in db.query(ReadingCategoryModel)
        .filter(ReadingCategoryModel.user_id == uid)
        .all()
    }

    for bp in body.books:
        book = ReadingBookModel(
            id=bp.id[:64],
            user_id=uid,
            author_id=bp.author_id[:64],
            title=bp.title[:1024],
            shelf=bp.shelf,
            progress_percent=bp.progress_percent,
            rating=bp.rating,
            started_at=bp.started_at,
            finished_at=bp.finished_at,
        )
        book.categories = [
            cat_map[cid[:64]]
            for cid in bp.category_ids
            if cid[:64] in cat_map
        ]
        db.add(book)

    db.commit()
    return _library_to_out(db, uid)
