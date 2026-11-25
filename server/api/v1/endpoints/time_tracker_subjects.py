from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.user import User
from models.time_tracker_subject import (
    TimeTrackerGoal,
    TimeTrackerProject,
    TimeTrackerCategory,
    normalize_name_key,
)
from schemas.time_tracker_subject import (
    TimeTrackerGoalOut,
    TimeTrackerGoalCreate,
    TimeTrackerGoalUpdate,
    TimeTrackerProjectOut,
    TimeTrackerProjectCreate,
    TimeTrackerProjectUpdate,
    TimeTrackerCategoryOut,
    TimeTrackerCategoryCreate,
    TimeTrackerCategoryUpdate,
)

router = APIRouter()


def _get_owned_goal(db: Session, user_id: int, goal_id: int) -> TimeTrackerGoal:
    goal = (
        db.query(TimeTrackerGoal)
        .filter(TimeTrackerGoal.id == goal_id, TimeTrackerGoal.user_id == user_id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return goal


def _get_owned_project(db: Session, user_id: int, project_id: int) -> TimeTrackerProject:
    project = (
        db.query(TimeTrackerProject)
        .filter(
            TimeTrackerProject.id == project_id,
            TimeTrackerProject.user_id == user_id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_owned_category(db: Session, user_id: int, category_id: int) -> TimeTrackerCategory:
    category = (
        db.query(TimeTrackerCategory)
        .filter(
            TimeTrackerCategory.id == category_id,
            TimeTrackerCategory.user_id == user_id,
        )
        .first()
    )
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


def _assert_unique_name(
    db: Session, model, user_id: int, name: str, exclude_id: int | None = None
) -> None:
    key = normalize_name_key(name)
    q = db.query(model).filter(model.user_id == user_id, model.name_key == key)
    if exclude_id is not None:
        q = q.filter(model.id != exclude_id)
    if q.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A record with this name already exists",
        )


# --- Goals ---


@router.get("/goals", response_model=List[TimeTrackerGoalOut])
def list_time_tracker_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(TimeTrackerGoal)
        .filter(TimeTrackerGoal.user_id == current_user.id)
        .order_by(TimeTrackerGoal.name)
        .all()
    )


@router.post("/goals", response_model=TimeTrackerGoalOut, status_code=status.HTTP_201_CREATED)
def create_time_tracker_goal(
    body: TimeTrackerGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    _assert_unique_name(db, TimeTrackerGoal, current_user.id, name)
    goal = TimeTrackerGoal(user_id=current_user.id, name=name, end_date=body.end_date)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/goals/{goal_id}", response_model=TimeTrackerGoalOut)
def update_time_tracker_goal(
    goal_id: int,
    body: TimeTrackerGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = _get_owned_goal(db, current_user.id, goal_id)
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
        _assert_unique_name(db, TimeTrackerGoal, current_user.id, name, exclude_id=goal.id)
        goal.name = name
    if "end_date" in data:
        goal.end_date = data["end_date"]
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_tracker_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = _get_owned_goal(db, current_user.id, goal_id)
    db.delete(goal)
    db.commit()


# --- Projects ---


@router.get("/projects", response_model=List[TimeTrackerProjectOut])
def list_time_tracker_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(TimeTrackerProject)
        .filter(TimeTrackerProject.user_id == current_user.id)
        .order_by(TimeTrackerProject.name)
        .all()
    )


@router.post(
    "/projects", response_model=TimeTrackerProjectOut, status_code=status.HTTP_201_CREATED
)
def create_time_tracker_project(
    body: TimeTrackerProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    _assert_unique_name(db, TimeTrackerProject, current_user.id, name)
    if body.goal_id is not None:
        _get_owned_goal(db, current_user.id, body.goal_id)
    if body.category_id is not None:
        _get_owned_category(db, current_user.id, body.category_id)
    project = TimeTrackerProject(
        user_id=current_user.id,
        name=name,
        goal_id=body.goal_id,
        category_id=body.category_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=TimeTrackerProjectOut)
def update_time_tracker_project(
    project_id: int,
    body: TimeTrackerProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, current_user.id, project_id)
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
        _assert_unique_name(db, TimeTrackerProject, current_user.id, name, exclude_id=project.id)
        project.name = name
    if "goal_id" in data:
        if data["goal_id"] is not None:
            _get_owned_goal(db, current_user.id, data["goal_id"])
        project.goal_id = data["goal_id"]
    if "category_id" in data:
        if data["category_id"] is not None:
            _get_owned_category(db, current_user.id, data["category_id"])
        project.category_id = data["category_id"]
    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_tracker_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, current_user.id, project_id)
    db.delete(project)
    db.commit()


# --- Categories ---


@router.get("/categories", response_model=List[TimeTrackerCategoryOut])
def list_time_tracker_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(TimeTrackerCategory)
        .filter(TimeTrackerCategory.user_id == current_user.id)
        .order_by(TimeTrackerCategory.name)
        .all()
    )


@router.post(
    "/categories", response_model=TimeTrackerCategoryOut, status_code=status.HTTP_201_CREATED
)
def create_time_tracker_category(
    body: TimeTrackerCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    _assert_unique_name(db, TimeTrackerCategory, current_user.id, name)
    category = TimeTrackerCategory(user_id=current_user.id, name=name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=TimeTrackerCategoryOut)
def update_time_tracker_category(
    category_id: int,
    body: TimeTrackerCategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = _get_owned_category(db, current_user.id, category_id)
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
        _assert_unique_name(db, TimeTrackerCategory, current_user.id, name, exclude_id=category.id)
        category.name = name
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_tracker_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = _get_owned_category(db, current_user.id, category_id)
    db.delete(category)
    db.commit()
