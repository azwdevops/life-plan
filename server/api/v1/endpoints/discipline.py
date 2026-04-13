import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.discipline_track import DisciplineTrack as DisciplineTrackModel
from models.user import User
from schemas.discipline import (
    DisciplineCategoryCreate,
    DisciplineCategoryOut,
    DisciplineCategoryPatch,
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


def _row_to_out(row: DisciplineTrackModel) -> DisciplineCategoryOut:
    return DisciplineCategoryOut(
        id=_client_id(row),
        label=row.label,
        count=int(row.count),
    )


def _build_store_out(db: Session, user_id: int) -> DisciplineStoreOut:
    rows = (
        db.query(DisciplineTrackModel)
        .filter(DisciplineTrackModel.user_id == user_id)
        .order_by(DisciplineTrackModel.id.asc())
        .all()
    )
    return DisciplineStoreOut(
        v=1,
        categories=[_row_to_out(r) for r in rows],
    )


@router.get("/", response_model=DisciplineStoreOut)
async def get_discipline_store(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_store_out(db, current_user.id)


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
        count=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_out(row)


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
        row.count = int(body.count)

    db.commit()
    db.refresh(row)
    return _row_to_out(row)


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
