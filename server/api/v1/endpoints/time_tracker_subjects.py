from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.user import User
from models.time_tracker_subject import TimeTrackerGoal, TimeTrackerProject
from schemas.time_tracker_subject import TimeTrackerGoalOut, TimeTrackerProjectOut

router = APIRouter()


@router.get("/goals", response_model=List[TimeTrackerGoalOut])
async def list_time_tracker_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(TimeTrackerGoal)
        .filter(TimeTrackerGoal.user_id == current_user.id)
        .order_by(TimeTrackerGoal.name)
        .all()
    )


@router.get("/projects", response_model=List[TimeTrackerProjectOut])
async def list_time_tracker_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(TimeTrackerProject)
        .filter(TimeTrackerProject.user_id == current_user.id)
        .order_by(TimeTrackerProject.name)
        .all()
    )
