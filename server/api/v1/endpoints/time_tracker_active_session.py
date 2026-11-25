import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from core.security import decode_access_token
from core.redis import publish_active_session_event, subscribe_active_session_events
from models.user import User
from models.time_tracker_entry import TimeTrackerEntry as TimeTrackerEntryModel
from models.time_tracker_active_session import TimeTrackerActiveSession
from models.time_tracker_subject import TimeTrackerGoal, TimeTrackerProject
from api.v1.endpoints.time_entries import _resolve_category_snapshot
from schemas.time_tracker_active_session import (
    TimeTrackerActiveSessionOut,
    TimeTrackerActiveSessionStart,
    TimeTrackerActiveSessionStartResponse,
    TimeTrackerActiveSessionUpdate,
)
from schemas.time_tracker_entry import TimeTrackerEntryResponse

router = APIRouter()


async def get_current_user_from_query_token(
    token: str = Query(...), db: Session = Depends(get_db)
) -> User:
    """SSE-only auth path: the browser's native EventSource can't set an
    Authorization header, so the token travels as a query param instead."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def _elapsed_ms(
    started_at: datetime,
    accumulated_pause_ms: int,
    pause_started_at: Optional[datetime],
    now: datetime,
) -> int:
    end_point = pause_started_at if pause_started_at is not None else now
    elapsed = (end_point - started_at).total_seconds() * 1000 - accumulated_pause_ms
    return max(0, int(elapsed))


def _entry_row_to_response(row: TimeTrackerEntryModel) -> TimeTrackerEntryResponse:
    return TimeTrackerEntryResponse(
        id=row.client_entry_id,
        kind=row.kind,  # type: ignore[arg-type]
        subject_id=row.subject_id,
        subject_name=row.subject_name,
        goal_id=row.goal_id,
        project_id=row.project_id,
        category_id=row.category_id,
        category_name=row.category_name,
        parent_goal_id=row.parent_goal_id,
        parent_goal_name=row.parent_goal_name,
        description=row.description or "",
        started_at=row.started_at,
        ended_at=row.ended_at,
        duration_ms=row.duration_ms,
    )


def _close_session_into_entry(
    db: Session, session: TimeTrackerActiveSession, now: datetime
) -> TimeTrackerEntryModel:
    duration_ms = _elapsed_ms(
        session.started_at, session.accumulated_pause_ms, session.pause_started_at, now
    )
    subject_id = str(session.goal_id if session.kind == "goal" else session.project_id)
    entry = TimeTrackerEntryModel(
        user_id=session.user_id,
        client_entry_id=str(uuid.uuid4())[:64],
        kind=session.kind,
        subject_id=subject_id[:512],
        subject_name=session.subject_name[:512],
        goal_id=session.goal_id,
        project_id=session.project_id,
        category_id=session.category_id,
        category_name=session.category_name,
        parent_goal_id=session.parent_goal_id,
        parent_goal_name=session.parent_goal_name,
        description=session.description or "",
        started_at=session.started_at,
        ended_at=now,
        duration_ms=duration_ms,
    )
    db.add(entry)
    return entry


@router.get("/active-session", response_model=Optional[TimeTrackerActiveSessionOut])
async def get_active_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(TimeTrackerActiveSession)
        .filter(TimeTrackerActiveSession.user_id == current_user.id)
        .first()
    )


@router.post(
    "/active-session/start",
    response_model=TimeTrackerActiveSessionStartResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_active_session(
    body: TimeTrackerActiveSessionStart,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.goal_id is not None:
        owned_goal = (
            db.query(TimeTrackerGoal)
            .filter(TimeTrackerGoal.id == body.goal_id, TimeTrackerGoal.user_id == current_user.id)
            .first()
        )
        if owned_goal is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    if body.project_id is not None:
        owned_project = (
            db.query(TimeTrackerProject)
            .filter(
                TimeTrackerProject.id == body.project_id,
                TimeTrackerProject.user_id == current_user.id,
            )
            .first()
        )
        if owned_project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    category_id, category_name = _resolve_category_snapshot(db, body.project_id)

    now = datetime.now(timezone.utc)
    existing = (
        db.query(TimeTrackerActiveSession)
        .filter(TimeTrackerActiveSession.user_id == current_user.id)
        .first()
    )
    auto_closed_entry: Optional[TimeTrackerEntryModel] = None
    if existing is not None:
        auto_closed_entry = _close_session_into_entry(db, existing, now)
        db.delete(existing)

    new_session = TimeTrackerActiveSession(
        user_id=current_user.id,
        kind=body.kind,
        goal_id=body.goal_id,
        project_id=body.project_id,
        category_id=category_id,
        category_name=category_name,
        subject_name=body.subject_name[:512],
        parent_goal_id=(body.parent_goal_id[:512] if body.parent_goal_id else None),
        parent_goal_name=(body.parent_goal_name[:512] if body.parent_goal_name else None),
        description=body.description or "",
        started_at=now,
        accumulated_pause_ms=0,
        pause_started_at=None,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    await publish_active_session_event(
        current_user.id,
        {"type": "replaced" if auto_closed_entry else "started"},
    )

    return TimeTrackerActiveSessionStartResponse(
        active_session=TimeTrackerActiveSessionOut.model_validate(new_session),
        auto_closed_entry=(
            _entry_row_to_response(auto_closed_entry) if auto_closed_entry else None
        ),
    )


@router.post("/active-session/stop", response_model=TimeTrackerEntryResponse)
async def stop_active_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(TimeTrackerActiveSession)
        .filter(TimeTrackerActiveSession.user_id == current_user.id)
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No active session"
        )
    now = datetime.now(timezone.utc)
    entry = _close_session_into_entry(db, session, now)
    db.delete(session)
    db.commit()
    db.refresh(entry)

    await publish_active_session_event(current_user.id, {"type": "stopped"})

    return _entry_row_to_response(entry)


@router.patch("/active-session", response_model=TimeTrackerActiveSessionOut)
async def update_active_session(
    body: TimeTrackerActiveSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(TimeTrackerActiveSession)
        .filter(TimeTrackerActiveSession.user_id == current_user.id)
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No active session"
        )
    now = datetime.now(timezone.utc)
    data = body.model_dump(exclude_unset=True)
    if data.get("action") == "pause" and session.pause_started_at is None:
        session.pause_started_at = now
    elif data.get("action") == "resume" and session.pause_started_at is not None:
        paused_ms = (now - session.pause_started_at).total_seconds() * 1000
        session.accumulated_pause_ms = session.accumulated_pause_ms + max(0, int(paused_ms))
        session.pause_started_at = None
    if "description" in data and data["description"] is not None:
        session.description = data["description"]
    db.commit()
    db.refresh(session)

    await publish_active_session_event(current_user.id, {"type": "updated"})

    return session


@router.get("/active-session/stream")
async def stream_active_session(
    current_user: User = Depends(get_current_user_from_query_token),
):
    async def event_generator():
        async for message in subscribe_active_session_events(current_user.id):
            yield f"data: {message}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
