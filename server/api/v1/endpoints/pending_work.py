import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.pending_work import (
    PendingWorkCategory as PendingWorkCategoryModel,
    PendingWorkItem as PendingWorkItemModel,
)
from models.user import User
from schemas.pending_work import (
    PendingWorkCategoryCreate,
    PendingWorkCategoryCreateResponse,
    PendingWorkCategoryOut,
    PendingWorkCategoryPatch,
    PendingWorkItemCreate,
    PendingWorkItemOut,
    PendingWorkItemPatch,
    PendingWorkStoreOut,
)

router = APIRouter()


def _cat_client_id(row: PendingWorkCategoryModel) -> str:
    return row.client_id[:64]


def _item_to_out(row: PendingWorkItemModel) -> PendingWorkItemOut:
    cid = row.category.client_id if row.category else ""
    return PendingWorkItemOut(
        id=row.client_id[:64],
        category_id=cid[:64],
        title=row.title,
    )


def _build_store_out(db: Session, user_id: int) -> PendingWorkStoreOut:
    cats = (
        db.query(PendingWorkCategoryModel)
        .filter(PendingWorkCategoryModel.user_id == user_id)
        .order_by(PendingWorkCategoryModel.created_at.asc(), PendingWorkCategoryModel.id.asc())
        .all()
    )
    items = (
        db.query(PendingWorkItemModel)
        .options(joinedload(PendingWorkItemModel.category))
        .filter(PendingWorkItemModel.user_id == user_id)
        .order_by(PendingWorkItemModel.created_at.asc(), PendingWorkItemModel.id.asc())
        .all()
    )
    return PendingWorkStoreOut(
        v=1,
        categories=[PendingWorkCategoryOut(id=_cat_client_id(c), name=c.name) for c in cats],
        items=[_item_to_out(i) for i in items],
    )


def _get_category_for_user(
    db: Session, user_id: int, client_id: str
) -> PendingWorkCategoryModel:
    cid = client_id[:64]
    row = (
        db.query(PendingWorkCategoryModel)
        .filter(
            PendingWorkCategoryModel.user_id == user_id,
            PendingWorkCategoryModel.client_id == cid,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return row


def _normalized_category_name(name: str) -> str:
    return name.strip().lower()[:256]


def _category_name_taken(
    db: Session,
    user_id: int,
    name: str,
    exclude_category_pk: int | None = None,
) -> bool:
    key = _normalized_category_name(name)
    if not key:
        return False
    q = db.query(PendingWorkCategoryModel.id).filter(
        PendingWorkCategoryModel.user_id == user_id,
        func.lower(PendingWorkCategoryModel.name) == key,
    )
    if exclude_category_pk is not None:
        q = q.filter(PendingWorkCategoryModel.id != exclude_category_pk)
    return q.first() is not None


def _normalized_item_title(title: str) -> str:
    return title.strip().lower()[:512]


def _item_title_taken_in_category(
    db: Session,
    user_id: int,
    category_pk: int,
    title: str,
    exclude_item_pk: int | None = None,
) -> bool:
    key = _normalized_item_title(title)
    if not key:
        return False
    q = db.query(PendingWorkItemModel.id).filter(
        PendingWorkItemModel.user_id == user_id,
        PendingWorkItemModel.category_id == category_pk,
        func.lower(PendingWorkItemModel.title) == key,
    )
    if exclude_item_pk is not None:
        q = q.filter(PendingWorkItemModel.id != exclude_item_pk)
    return q.first() is not None


def _get_item_for_user(db: Session, user_id: int, client_id: str) -> PendingWorkItemModel:
    cid = client_id[:64]
    row = (
        db.query(PendingWorkItemModel)
        .filter(
            PendingWorkItemModel.user_id == user_id,
            PendingWorkItemModel.client_id == cid,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return row


@router.get("/", response_model=PendingWorkStoreOut)
async def get_pending_work_store(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_store_out(db, current_user.id)


@router.post("/categories", response_model=PendingWorkCategoryCreateResponse)
async def create_pending_category(
    body: PendingWorkCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")

    if _category_name_taken(db, current_user.id, name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name already exists",
        )

    client_id = str(uuid.uuid4())[:64]
    row = PendingWorkCategoryModel(
        user_id=current_user.id,
        client_id=client_id,
        name=name[:256],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return PendingWorkCategoryCreateResponse(
        category=PendingWorkCategoryOut(id=_cat_client_id(row), name=row.name),
    )


@router.patch("/categories/{client_id}", response_model=PendingWorkCategoryOut)
async def patch_pending_category(
    client_id: str,
    body: PendingWorkCategoryPatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_category_for_user(db, current_user.id, client_id)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    if _category_name_taken(db, current_user.id, name, exclude_category_pk=row.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name already exists",
        )
    row.name = name[:256]
    db.commit()
    db.refresh(row)
    return PendingWorkCategoryOut(id=_cat_client_id(row), name=row.name)


@router.delete("/categories/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pending_category(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_category_for_user(db, current_user.id, client_id)
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/items", response_model=PendingWorkItemOut)
async def create_pending_item(
    body: PendingWorkItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")

    cat = _get_category_for_user(db, current_user.id, body.category_id)
    if _item_title_taken_in_category(db, current_user.id, cat.id, title):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An item with this title already exists in this category",
        )
    item_cid = str(uuid.uuid4())[:64]
    item_row = PendingWorkItemModel(
        user_id=current_user.id,
        client_id=item_cid,
        category_id=cat.id,
        title=title[:512],
    )
    db.add(item_row)
    db.commit()
    db.refresh(item_row)
    db.refresh(item_row, ["category"])
    return _item_to_out(item_row)


@router.patch("/items/{client_id}", response_model=PendingWorkItemOut)
async def patch_pending_item(
    client_id: str,
    body: PendingWorkItemPatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_item_for_user(db, current_user.id, client_id)
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")
    if _item_title_taken_in_category(
        db, current_user.id, row.category_id, title, exclude_item_pk=row.id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An item with this title already exists in this category",
        )
    row.title = title[:512]
    db.commit()
    db.refresh(row, ["category"])
    return _item_to_out(row)


@router.delete("/items/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pending_item(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_item_for_user(db, current_user.id, client_id)
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
