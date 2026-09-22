import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.daily_productive_item import DailyProductiveItem as DailyProductiveItemModel
from models.user import User
from schemas.daily_productive_item import (
    DailyProductiveItemCreate,
    DailyProductiveItemListOut,
    DailyProductiveItemOut,
    DailyProductiveItemPatch,
)

router = APIRouter()


def _client_id(row: DailyProductiveItemModel) -> str:
    return row.client_id[:64]


def _parse_iso_date(raw: str, field_name: str) -> date:
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be YYYY-MM-DD",
        ) from exc


def _is_editable(target: date) -> bool:
    today = date.today()
    return today - timedelta(days=1) <= target <= today


def _assert_editable(target: date) -> None:
    if not _is_editable(target):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only today's or yesterday's list can be changed",
        )


def _row_to_out(row: DailyProductiveItemModel) -> DailyProductiveItemOut:
    return DailyProductiveItemOut(
        id=_client_id(row),
        item_date=row.item_date.isoformat(),
        text=row.text,
        is_done=bool(row.is_done),
    )


def _get_item_for_user(db: Session, user_id: int, client_id: str) -> DailyProductiveItemModel:
    cid = client_id[:64]
    row = (
        db.query(DailyProductiveItemModel)
        .filter(
            DailyProductiveItemModel.user_id == user_id,
            DailyProductiveItemModel.client_id == cid,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return row


@router.get("/", response_model=DailyProductiveItemListOut)
async def list_daily_productive_items(
    item_date: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = _parse_iso_date(item_date, "item_date") if item_date else date.today()
    rows = (
        db.query(DailyProductiveItemModel)
        .filter(
            DailyProductiveItemModel.user_id == current_user.id,
            DailyProductiveItemModel.item_date == target,
        )
        .order_by(DailyProductiveItemModel.id.asc())
        .all()
    )
    return DailyProductiveItemListOut(
        item_date=target.isoformat(),
        editable=_is_editable(target),
        items=[_row_to_out(r) for r in rows],
    )


@router.post("/", response_model=DailyProductiveItemOut)
async def create_daily_productive_item(
    body: DailyProductiveItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text is required")
    target = _parse_iso_date(body.item_date, "item_date")
    _assert_editable(target)

    client_id = str(uuid.uuid4())[:64]
    row = DailyProductiveItemModel(
        user_id=current_user.id,
        client_id=client_id,
        item_date=target,
        text=text[:500],
        is_done=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_out(row)


@router.patch("/{client_id}", response_model=DailyProductiveItemOut)
async def patch_daily_productive_item(
    client_id: str,
    body: DailyProductiveItemPatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_item_for_user(db, current_user.id, client_id)
    _assert_editable(row.item_date)

    if body.text is not None:
        new_text = body.text.strip()
        if not new_text:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text is required")
        row.text = new_text[:500]

    if body.is_done is not None:
        row.is_done = bool(body.is_done)

    db.commit()
    db.refresh(row)
    return _row_to_out(row)
