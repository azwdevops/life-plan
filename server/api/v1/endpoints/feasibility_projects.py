from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.feasibility import FeasibilityLineItem, FeasibilityProject
from models.user import User
from schemas.feasibility import (
    FeasibilityLineItemResponse,
    FeasibilityProjectCreate,
    FeasibilityProjectPut,
    FeasibilityProjectResponse,
)

router = APIRouter()


def _line_item_to_response(row: FeasibilityLineItem) -> FeasibilityLineItemResponse:
    return FeasibilityLineItemResponse(
        id=row.id,
        label=row.label,
        unit_cost=float(row.unit_cost),
        quantity=row.quantity,
        sort_order=row.sort_order,
    )


def _project_to_response(row: FeasibilityProject) -> FeasibilityProjectResponse:
    items = sorted(row.line_items, key=lambda x: x.sort_order)
    return FeasibilityProjectResponse(
        id=row.id,
        user_id=row.user_id,
        name=row.name,
        items=[_line_item_to_response(i) for i in items],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _replace_line_items(
    db: Session, project: FeasibilityProject, items_payload: list
) -> None:
    db.query(FeasibilityLineItem).filter(
        FeasibilityLineItem.project_id == project.id
    ).delete(synchronize_session=False)
    for idx, item in enumerate(items_payload):
        db.add(
            FeasibilityLineItem(
                project_id=project.id,
                label=item.label,
                unit_cost=Decimal(str(item.unit_cost)),
                quantity=item.quantity,
                sort_order=idx,
            )
        )


@router.get(
    "/feasibility-projects",
    response_model=list[FeasibilityProjectResponse],
)
async def list_feasibility_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(FeasibilityProject)
        .options(joinedload(FeasibilityProject.line_items))
        .filter(FeasibilityProject.user_id == current_user.id)
        .order_by(FeasibilityProject.created_at.asc())
        .all()
    )
    return [_project_to_response(r) for r in rows]


@router.post(
    "/feasibility-projects",
    response_model=FeasibilityProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_feasibility_project(
    body: FeasibilityProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project name is required",
        )
    project = FeasibilityProject(user_id=current_user.id, name=body.name.strip())
    db.add(project)
    db.flush()
    _replace_line_items(db, project, body.items)
    db.commit()
    row = (
        db.query(FeasibilityProject)
        .options(joinedload(FeasibilityProject.line_items))
        .filter(
            FeasibilityProject.id == project.id,
            FeasibilityProject.user_id == current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return _project_to_response(row)


@router.put(
    "/feasibility-projects/{project_id}",
    response_model=FeasibilityProjectResponse,
)
async def update_feasibility_project(
    project_id: int,
    body: FeasibilityProjectPut,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project name is required",
        )
    project = (
        db.query(FeasibilityProject)
        .filter(
            FeasibilityProject.id == project_id,
            FeasibilityProject.user_id == current_user.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    project.name = body.name.strip()
    _replace_line_items(db, project, body.items)
    db.commit()
    row = (
        db.query(FeasibilityProject)
        .options(joinedload(FeasibilityProject.line_items))
        .filter(
            FeasibilityProject.id == project_id,
            FeasibilityProject.user_id == current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return _project_to_response(row)


@router.delete(
    "/feasibility-projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_feasibility_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = (
        db.query(FeasibilityProject)
        .filter(
            FeasibilityProject.id == project_id,
            FeasibilityProject.user_id == current_user.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    db.delete(project)
    db.commit()
    return None
