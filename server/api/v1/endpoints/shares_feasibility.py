from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.shares_feasibility import SharesFeasibilityWorkspace
from models.user import User
from schemas.shares_feasibility import (
    SharesFeasibilityWorkspaceOut,
    SharesFeasibilityWorkspacePut,
)

router = APIRouter()

_DEFAULT_STATE: dict = {
    "companies": [],
    "accounts": [],
    "variables": [],
    "years": [],
    "values": {},
    "formulas": [],
    "computedResults": {},
}


@router.get(
    "/shares-feasibility",
    response_model=SharesFeasibilityWorkspaceOut,
)
async def get_shares_feasibility_workspace(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(SharesFeasibilityWorkspace)
        .filter(SharesFeasibilityWorkspace.user_id == current_user.id)
        .first()
    )
    if not row:
        return SharesFeasibilityWorkspaceOut(state=dict(_DEFAULT_STATE))
    return SharesFeasibilityWorkspaceOut(state=dict(row.state_json))


@router.put(
    "/shares-feasibility",
    response_model=SharesFeasibilityWorkspaceOut,
    status_code=status.HTTP_200_OK,
)
async def put_shares_feasibility_workspace(
    body: SharesFeasibilityWorkspacePut,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(SharesFeasibilityWorkspace)
        .filter(SharesFeasibilityWorkspace.user_id == current_user.id)
        .first()
    )
    payload = dict(body.state)
    if row:
        row.state_json = payload
    else:
        row = SharesFeasibilityWorkspace(user_id=current_user.id, state_json=payload)
        db.add(row)
    db.commit()
    db.refresh(row)
    return SharesFeasibilityWorkspaceOut(state=dict(row.state_json))
