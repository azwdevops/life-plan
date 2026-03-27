import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.finance import PlotProspect, PlotProspectStage
from models.user import User
from schemas.investments import (
    PlotProspectCreate,
    PlotProspectResponse,
    PlotProspectUpdate,
    PlotProspectStageCreate,
    PlotProspectStageDeleteRequest,
    PlotProspectStageResponse,
    PlotProspectStageUpdate,
)

router = APIRouter()


def _ensure_default_stages(db: Session, user_id: int) -> None:
    existing_count = (
        db.query(PlotProspectStage)
        .filter(PlotProspectStage.user_id == user_id, PlotProspectStage.is_active == True)
        .count()
    )
    if existing_count > 0:
        return
    defaults = ["New lead", "Contacted", "Negotiating", "Site visit", "Closed"]
    for name in defaults:
        db.add(PlotProspectStage(user_id=user_id, name=name))
    db.commit()


def _to_plot_prospect_response(row: PlotProspect) -> PlotProspectResponse:
    return PlotProspectResponse(
        id=row.id,
        user_id=row.user_id,
        stage_id=row.stage_id,
        stage_name=row.stage.name if row.stage else "",
        name=row.name,
        phones=json.loads(row.phones_json),
        dealer_name=row.dealer_name,
        location=row.location,
        map_pin=row.map_pin,
        plot_size=row.plot_size,
        price=row.price,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/plot-stages", response_model=list[PlotProspectStageResponse])
async def get_plot_stages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_default_stages(db, current_user.id)
    return (
        db.query(PlotProspectStage)
        .filter(PlotProspectStage.user_id == current_user.id, PlotProspectStage.is_active == True)
        .order_by(PlotProspectStage.created_at.asc())
        .all()
    )


@router.post("/plot-stages", response_model=PlotProspectStageResponse, status_code=status.HTTP_201_CREATED)
async def create_plot_stage(
    stage_data: PlotProspectStageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = stage_data.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stage name is required")

    existing = (
        db.query(PlotProspectStage)
        .filter(
            PlotProspectStage.user_id == current_user.id,
            PlotProspectStage.is_active == True,
            PlotProspectStage.name == name,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stage already exists")

    stage = PlotProspectStage(user_id=current_user.id, name=name)
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.put("/plot-stages/{stage_id}", response_model=PlotProspectStageResponse)
async def update_plot_stage(
    stage_id: int,
    stage_data: PlotProspectStageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stage = (
        db.query(PlotProspectStage)
        .filter(
            PlotProspectStage.id == stage_id,
            PlotProspectStage.user_id == current_user.id,
            PlotProspectStage.is_active == True,
        )
        .first()
    )
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")

    name = stage_data.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stage name is required")

    duplicate = (
        db.query(PlotProspectStage)
        .filter(
            PlotProspectStage.user_id == current_user.id,
            PlotProspectStage.is_active == True,
            PlotProspectStage.name == name,
            PlotProspectStage.id != stage_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stage name already exists")

    stage.name = name
    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/plot-stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plot_stage(
    stage_id: int,
    delete_data: PlotProspectStageDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stage = (
        db.query(PlotProspectStage)
        .filter(
            PlotProspectStage.id == stage_id,
            PlotProspectStage.user_id == current_user.id,
            PlotProspectStage.is_active == True,
        )
        .first()
    )
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")

    stage_count = (
        db.query(PlotProspectStage)
        .filter(PlotProspectStage.user_id == current_user.id, PlotProspectStage.is_active == True)
        .count()
    )
    if stage_count <= 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one stage is required")

    prospects_using_stage = (
        db.query(PlotProspect)
        .filter(PlotProspect.user_id == current_user.id, PlotProspect.stage_id == stage_id)
        .count()
    )
    if prospects_using_stage > 0:
        if not delete_data.replacement_stage_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="replacement_stage_id is required when deleting a stage in use",
            )
        replacement = (
            db.query(PlotProspectStage)
            .filter(
                PlotProspectStage.id == delete_data.replacement_stage_id,
                PlotProspectStage.user_id == current_user.id,
                PlotProspectStage.is_active == True,
            )
            .first()
        )
        if not replacement:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Replacement stage not found")
        if replacement.id == stage_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Replacement stage must differ")
        (
            db.query(PlotProspect)
            .filter(PlotProspect.user_id == current_user.id, PlotProspect.stage_id == stage_id)
            .update({PlotProspect.stage_id: replacement.id}, synchronize_session=False)
        )

    stage.is_active = False
    db.commit()
    return None


@router.get("/plot-prospects", response_model=list[PlotProspectResponse])
async def get_plot_prospects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(PlotProspect)
        .options(joinedload(PlotProspect.stage))
        .filter(PlotProspect.user_id == current_user.id)
        .order_by(PlotProspect.created_at.desc())
        .all()
    )
    return [_to_plot_prospect_response(row) for row in rows]


@router.post("/plot-prospects", response_model=PlotProspectResponse, status_code=status.HTTP_201_CREATED)
async def create_plot_prospect(
    prospect_data: PlotProspectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stage = (
        db.query(PlotProspectStage)
        .filter(
            PlotProspectStage.id == prospect_data.stage_id,
            PlotProspectStage.user_id == current_user.id,
            PlotProspectStage.is_active == True,
        )
        .first()
    )
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")

    phones = [p.strip() for p in prospect_data.phones if p.strip()]
    if not phones:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one phone is required")
    if len(phones) > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 5 phone numbers allowed")

    plot = PlotProspect(
        user_id=current_user.id,
        stage_id=prospect_data.stage_id,
        name=prospect_data.name.strip(),
        phones_json=json.dumps(phones),
        dealer_name=prospect_data.dealer_name.strip() if prospect_data.dealer_name else None,
        location=prospect_data.location.strip(),
        map_pin=prospect_data.map_pin.strip() if prospect_data.map_pin else None,
        plot_size=prospect_data.plot_size.strip() if prospect_data.plot_size else None,
        price=prospect_data.price.strip(),
    )
    db.add(plot)
    db.commit()
    plot = (
        db.query(PlotProspect)
        .options(joinedload(PlotProspect.stage))
        .filter(PlotProspect.id == plot.id, PlotProspect.user_id == current_user.id)
        .first()
    )
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot prospect not found")
    return _to_plot_prospect_response(plot)


@router.put("/plot-prospects/{prospect_id}", response_model=PlotProspectResponse)
async def update_plot_prospect(
    prospect_id: int,
    prospect_data: PlotProspectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plot = (
        db.query(PlotProspect)
        .filter(PlotProspect.id == prospect_id, PlotProspect.user_id == current_user.id)
        .first()
    )
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot prospect not found")

    stage = (
        db.query(PlotProspectStage)
        .filter(
            PlotProspectStage.id == prospect_data.stage_id,
            PlotProspectStage.user_id == current_user.id,
            PlotProspectStage.is_active == True,
        )
        .first()
    )
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")

    phones = [p.strip() for p in prospect_data.phones if p.strip()]
    if not phones:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one phone is required")
    if len(phones) > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 5 phone numbers allowed")

    plot.stage_id = prospect_data.stage_id
    plot.name = prospect_data.name.strip()
    plot.phones_json = json.dumps(phones)
    plot.dealer_name = prospect_data.dealer_name.strip() if prospect_data.dealer_name else None
    plot.location = prospect_data.location.strip()
    plot.map_pin = prospect_data.map_pin.strip() if prospect_data.map_pin else None
    plot.plot_size = prospect_data.plot_size.strip() if prospect_data.plot_size else None
    plot.price = prospect_data.price.strip()
    db.commit()

    updated = (
        db.query(PlotProspect)
        .options(joinedload(PlotProspect.stage))
        .filter(PlotProspect.id == prospect_id, PlotProspect.user_id == current_user.id)
        .first()
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot prospect not found")
    return _to_plot_prospect_response(updated)


@router.delete("/plot-prospects/{prospect_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plot_prospect(
    prospect_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plot = (
        db.query(PlotProspect)
        .filter(PlotProspect.id == prospect_id, PlotProspect.user_id == current_user.id)
        .first()
    )
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot prospect not found")
    db.delete(plot)
    db.commit()
    return None
