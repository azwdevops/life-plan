import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.discipline_track import (
    DisciplineTrack as DisciplineTrackModel,
    DisciplineTrackDailyCount as DisciplineTrackDailyCountModel,
)
from models.user import User
from schemas.discipline import (
    DisciplineCategoryCreate,
    DisciplineCategoryOut,
    DisciplineCategoryPatch,
    DisciplineHistoryCategoryOut,
    DisciplineHistoryOut,
    DisciplineHistoryPointOut,
    DisciplineStoreOut,
)

router = APIRouter()


def _client_id(row: DisciplineTrackModel) -> str:
    return row.client_id[:64]


def _normalized_label(label: str) -> str:
    return label.strip().lower()[:256]


def _label_taken(
    db: Session,
    user_id: int,
    label: str,
    exclude_track_pk: int | None = None,
) -> bool:
    key = _normalized_label(label)
    if not key:
        return False
    q = db.query(DisciplineTrackModel.id).filter(
        DisciplineTrackModel.user_id == user_id,
        func.lower(DisciplineTrackModel.label) == key,
    )
    if exclude_track_pk is not None:
        q = q.filter(DisciplineTrackModel.id != exclude_track_pk)
    return q.first() is not None


def _get_track_for_user(db: Session, user_id: int, client_id: str) -> DisciplineTrackModel:
    cid = client_id[:64]
    row = (
        db.query(DisciplineTrackModel)
        .filter(
            DisciplineTrackModel.user_id == user_id,
            DisciplineTrackModel.client_id == cid,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")
    return row


def _upsert_daily_count(
    db: Session,
    user_id: int,
    track_id: int,
    tracked_on: date,
    count: int | None = None,
) -> DisciplineTrackDailyCountModel:
    row = (
        db.query(DisciplineTrackDailyCountModel)
        .filter(
            DisciplineTrackDailyCountModel.user_id == user_id,
            DisciplineTrackDailyCountModel.track_id == track_id,
            DisciplineTrackDailyCountModel.tracked_on == tracked_on,
        )
        .first()
    )
    if row is None:
        row = DisciplineTrackDailyCountModel(
            user_id=user_id,
            track_id=track_id,
            tracked_on=tracked_on,
            count=0 if count is None else int(count),
        )
        db.add(row)
        return row
    if count is not None:
        row.count = int(count)
    return row


def _ensure_daily_counts_for_date(
    db: Session,
    user_id: int,
    track_ids: list[int],
    tracked_on: date,
) -> None:
    if not track_ids:
        return
    existing_track_ids = {
        track_id
        for (track_id,) in (
            db.query(DisciplineTrackDailyCountModel.track_id)
            .filter(
                DisciplineTrackDailyCountModel.user_id == user_id,
                DisciplineTrackDailyCountModel.tracked_on == tracked_on,
                DisciplineTrackDailyCountModel.track_id.in_(track_ids),
            )
            .all()
        )
    }
    for track_id in track_ids:
        if track_id not in existing_track_ids:
            db.add(
                DisciplineTrackDailyCountModel(
                    user_id=user_id,
                    track_id=track_id,
                    tracked_on=tracked_on,
                    count=0,
                )
            )


def _row_to_out(row: DisciplineTrackModel, count: int) -> DisciplineCategoryOut:
    return DisciplineCategoryOut(
        id=_client_id(row),
        label=row.label,
        count=int(count),
    )


def _build_store_out(db: Session, user_id: int) -> DisciplineStoreOut:
    today = date.today()
    rows = (
        db.query(DisciplineTrackModel)
        .filter(DisciplineTrackModel.user_id == user_id)
        .order_by(DisciplineTrackModel.id.asc())
        .all()
    )
    track_ids = [row.id for row in rows]
    _ensure_daily_counts_for_date(db, user_id, track_ids, today)
    db.commit()

    if not track_ids:
        daily_rows = []
    else:
        daily_rows = (
            db.query(DisciplineTrackDailyCountModel)
            .filter(
                DisciplineTrackDailyCountModel.user_id == user_id,
                DisciplineTrackDailyCountModel.tracked_on == today,
                DisciplineTrackDailyCountModel.track_id.in_(track_ids),
            )
            .all()
        )
    count_by_track_id = {r.track_id: int(r.count) for r in daily_rows}
    return DisciplineStoreOut(
        v=1,
        categories=[_row_to_out(r, count_by_track_id.get(r.id, 0)) for r in rows],
    )


def _parse_iso_date(raw: str, field_name: str) -> date:
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be YYYY-MM-DD",
        ) from exc


@router.get("/", response_model=DisciplineStoreOut)
async def get_discipline_store(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_store_out(db, current_user.id)


@router.get("/history", response_model=DisciplineHistoryOut)
async def get_discipline_history(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    start = _parse_iso_date(start_date, "start_date") if start_date else today - timedelta(days=29)
    end = _parse_iso_date(end_date, "end_date") if end_date else today
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be after end_date",
        )

    tracks = (
        db.query(DisciplineTrackModel)
        .filter(DisciplineTrackModel.user_id == current_user.id)
        .order_by(DisciplineTrackModel.id.asc())
        .all()
    )
    categories = [
        DisciplineHistoryCategoryOut(id=_client_id(track), label=track.label)
        for track in tracks
    ]
    if not tracks:
        return DisciplineHistoryOut(
            start_date=start.isoformat(),
            end_date=end.isoformat(),
            categories=[],
            points=[],
        )

    track_id_to_client_id = {track.id: _client_id(track) for track in tracks}
    daily_rows = (
        db.query(DisciplineTrackDailyCountModel)
        .filter(
            DisciplineTrackDailyCountModel.user_id == current_user.id,
            DisciplineTrackDailyCountModel.track_id.in_(list(track_id_to_client_id.keys())),
            DisciplineTrackDailyCountModel.tracked_on >= start,
            DisciplineTrackDailyCountModel.tracked_on <= end,
        )
        .all()
    )

    by_date_track: dict[date, dict[int, int]] = {}
    for row in daily_rows:
        by_date_track.setdefault(row.tracked_on, {})[row.track_id] = int(row.count)

    points: list[DisciplineHistoryPointOut] = []
    cur = start
    while cur <= end:
        day_counts: dict[str, int] = {}
        track_counts = by_date_track.get(cur, {})
        for track_id, client_id in track_id_to_client_id.items():
            day_counts[client_id] = int(track_counts.get(track_id, 0))
        points.append(
            DisciplineHistoryPointOut(
                date=cur.isoformat(),
                counts=day_counts,
            )
        )
        cur = cur + timedelta(days=1)

    return DisciplineHistoryOut(
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        categories=categories,
        points=points,
    )


@router.post("/tracks", response_model=DisciplineCategoryOut)
async def create_discipline_track(
    body: DisciplineCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    label = body.label.strip()
    if not label:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Label is required")

    if _label_taken(db, current_user.id, label):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A track with this label already exists",
        )

    client_id = str(uuid.uuid4())[:64]
    row = DisciplineTrackModel(
        user_id=current_user.id,
        client_id=client_id,
        label=label[:256],
    )
    db.add(row)
    db.flush()
    _upsert_daily_count(db, current_user.id, row.id, date.today(), count=0)
    db.commit()
    db.refresh(row)
    return _row_to_out(row, 0)


@router.patch("/tracks/{client_id}", response_model=DisciplineCategoryOut)
async def patch_discipline_track(
    client_id: str,
    body: DisciplineCategoryPatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_track_for_user(db, current_user.id, client_id)

    if body.label is not None:
        new_label = body.label.strip()
        if not new_label:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Label is required")
        if _label_taken(db, current_user.id, new_label, exclude_track_pk=row.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A track with this label already exists",
            )
        row.label = new_label[:256]

    if body.count is not None:
        today_row = _upsert_daily_count(
            db,
            current_user.id,
            row.id,
            date.today(),
            count=int(body.count),
        )
        row_count = int(today_row.count)
    else:
        today_row = _upsert_daily_count(db, current_user.id, row.id, date.today())
        row_count = int(today_row.count)

    db.commit()
    db.refresh(row)
    return _row_to_out(row, row_count)


@router.delete("/tracks/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_discipline_track(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_track_for_user(db, current_user.id, client_id)
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
