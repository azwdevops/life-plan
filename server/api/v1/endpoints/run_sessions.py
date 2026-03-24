from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from core.run_energy import (
    distance_km_from_speed,
    fat_equiv_kg_from_kcal,
    kcal_running_mass_distance,
)
from models.user import User
from models.run_session import RunSession
from schemas.run_session import (
    RunSessionComplete,
    RunSessionResponse,
    RunSessionStart,
)


def _fitness_complete(user: User) -> bool:
    if user.weight_kg is None or user.height_cm is None or user.age is None:
        return False
    return user.sex in ("male", "female", "other")


def require_fitness_for_runs(current_user: User = Depends(get_current_user)) -> User:
    if not _fitness_complete(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set all exercise metrics (weight, height, age, sex) in Settings before tracking runs.",
        )
    return current_user


router = APIRouter()


@router.post("/start", response_model=RunSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_run_session(
    body: RunSessionStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_fitness_for_runs),
):
    row = RunSession(
        user_id=current_user.id,
        speed_kmh=Decimal(str(round(body.speed_kmh, 2))),
        duration_seconds=0,
        tick_interval_seconds=body.tick_interval_seconds,
        distance_km=Decimal("0"),
        calories_kcal=Decimal("0"),
        fat_equiv_kg=Decimal("0"),
        is_completed=False,
    )
    if body.started_at is not None:
        row.created_at = body.started_at
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{session_id}/complete", response_model=RunSessionResponse)
async def complete_run_session(
    session_id: int,
    body: RunSessionComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_fitness_for_runs),
):
    row = (
        db.query(RunSession)
        .filter(
            RunSession.id == session_id,
            RunSession.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run session not found",
        )
    if row.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Run session already completed",
        )

    w = float(current_user.weight_kg)
    met = float(current_user.running_met) if current_user.running_met is not None else 1.0
    dur = float(body.duration_seconds)
    speed = float(row.speed_kmh)
    dist = distance_km_from_speed(speed, dur)
    kcal = kcal_running_mass_distance(w, dist, met=met)
    fat_kg = fat_equiv_kg_from_kcal(kcal)

    row.duration_seconds = body.duration_seconds
    row.tick_interval_seconds = body.tick_interval_seconds
    row.distance_km = Decimal(str(round(dist, 4)))
    row.calories_kcal = Decimal(str(round(kcal, 4)))
    row.fat_equiv_kg = Decimal(str(round(fat_kg, 6)))
    row.is_completed = True
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=list[RunSessionResponse])
async def list_run_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
):
    rows = (
        db.query(RunSession)
        .filter(
            RunSession.user_id == current_user.id,
            RunSession.is_completed.is_(True),
        )
        .order_by(RunSession.created_at.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(RunSession)
        .filter(
            RunSession.id == session_id,
            RunSession.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run session not found",
        )
    db.delete(row)
    db.commit()
    return None
