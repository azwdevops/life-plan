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
