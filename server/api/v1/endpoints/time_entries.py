import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.user import User
from models.time_tracker_entry import TimeTrackerEntry as TimeTrackerEntryModel
from schemas.time_tracker_entry import (
    TimeTrackerEntryCreate,
    TimeTrackerEntryResponse,
    TimeTrackerEntryUpdate,
)

router = APIRouter()


def _row_to_response(row: TimeTrackerEntryModel) -> TimeTrackerEntryResponse:
    return TimeTrackerEntryResponse(
        id=row.client_entry_id,
        kind=row.kind,  # type: ignore[arg-type]
        subject_id=row.subject_id,
        subject_name=row.subject_name,
        parent_goal_id=row.parent_goal_id,
        parent_goal_name=row.parent_goal_name,
        description=row.description or "",
        started_at=row.started_at,
        ended_at=row.ended_at,
        duration_ms=row.duration_ms,
    )


@router.get("/", response_model=List[TimeTrackerEntryResponse])
async def list_time_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    from_started_at: Optional[datetime] = Query(
        None,
        alias="from",
        description="Inclusive lower bound on started_at (ISO 8601)",
    ),
    to_started_at_exclusive: Optional[datetime] = Query(
        None,
        alias="to_exclusive",
        description="Exclusive upper bound on started_at (ISO 8601)",
    ),
    limit: int = Query(
        2000,
        ge=1,
        le=10000,
        description="With date range: max rows (cap). Without range: recent N rows.",
    ),
):
    """List entries: either [from, to_exclusive) or most recent `limit` rows."""
    q = db.query(TimeTrackerEntryModel).filter(
        TimeTrackerEntryModel.user_id == current_user.id
    )
    if from_started_at is not None or to_started_at_exclusive is not None:
        if from_started_at is None or to_started_at_exclusive is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide both from and to_exclusive, or neither for recent entries",
            )
        q = q.filter(
            TimeTrackerEntryModel.started_at >= from_started_at,
            TimeTrackerEntryModel.started_at < to_started_at_exclusive,
        )
        rows = (
            q.order_by(TimeTrackerEntryModel.started_at.desc())
            .limit(min(limit, 10000))
            .all()
        )
    else:
        rows = (
            q.order_by(TimeTrackerEntryModel.started_at.desc()).limit(limit).all()
        )
    return [_row_to_response(r) for r in rows]


@router.post(
    "/",
    response_model=TimeTrackerEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_time_entry(
    body: TimeTrackerEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(TimeTrackerEntryModel)
        .filter(
            TimeTrackerEntryModel.user_id == current_user.id,
            TimeTrackerEntryModel.client_entry_id == body.id,
        )
        .first()
    )
    if existing:
        return _row_to_response(existing)

    row = TimeTrackerEntryModel(
        user_id=current_user.id,
        client_entry_id=body.id[:64],
        kind=body.kind,
        subject_id=body.subject_id[:512],
        subject_name=body.subject_name[:512],
        parent_goal_id=(body.parent_goal_id[:512] if body.parent_goal_id else None),
        parent_goal_name=(
            body.parent_goal_name[:512] if body.parent_goal_name else None
        ),
        description=body.description or "",
        started_at=body.started_at,
        ended_at=body.ended_at,
        duration_ms=body.duration_ms,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_response(row)


def _get_entry_for_user(
    db: Session, user_id: int, client_entry_id: str
) -> TimeTrackerEntryModel:
    row = (
        db.query(TimeTrackerEntryModel)
        .filter(
            TimeTrackerEntryModel.user_id == user_id,
            TimeTrackerEntryModel.client_entry_id == client_entry_id[:64],
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time entry not found",
        )
    return row


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_entry_for_user(db, current_user.id, entry_id)
    db.delete(row)
    db.commit()


@router.patch("/{entry_id}", response_model=TimeTrackerEntryResponse)
async def update_time_entry(
    entry_id: str,
    body: TimeTrackerEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )
    row = _get_entry_for_user(db, current_user.id, entry_id)
    if "kind" in data:
        row.kind = data["kind"]
    if "subject_id" in data:
        row.subject_id = data["subject_id"][:512]
    if "subject_name" in data:
        row.subject_name = data["subject_name"][:512]
    if "parent_goal_id" in data:
        v = data["parent_goal_id"]
        row.parent_goal_id = (v[:512] if isinstance(v, str) and v else None)
    if "parent_goal_name" in data:
        v = data["parent_goal_name"]
        row.parent_goal_name = (v[:512] if isinstance(v, str) and v else None)
    if "description" in data:
        row.description = data["description"] or ""
    if "started_at" in data:
        row.started_at = data["started_at"]
    if "ended_at" in data:
        row.ended_at = data["ended_at"]
    if "duration_ms" in data:
        row.duration_ms = data["duration_ms"]
    if row.ended_at < row.started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ended_at must be >= started_at",
        )
    db.commit()
    db.refresh(row)
    return _row_to_response(row)


@router.post(
    "/{entry_id}/duplicate",
    response_model=TimeTrackerEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_time_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    src = _get_entry_for_user(db, current_user.id, entry_id)
    new_client_id = str(uuid.uuid4())[:64]
    copy_row = TimeTrackerEntryModel(
        user_id=current_user.id,
        client_entry_id=new_client_id,
        kind=src.kind,
        subject_id=src.subject_id,
        subject_name=src.subject_name,
        parent_goal_id=src.parent_goal_id,
        parent_goal_name=src.parent_goal_name,
        description=src.description or "",
        started_at=src.started_at,
        ended_at=src.ended_at,
        duration_ms=src.duration_ms,
    )
    db.add(copy_row)
    db.commit()
    db.refresh(copy_row)
    return _row_to_response(copy_row)
