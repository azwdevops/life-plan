from typing import Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.user import User
from models.time_tracker_entry import TimeTrackerEntry
from models.time_tracker_subject import (
    TimeTrackerGoal,
    TimeTrackerProject,
    normalize_name_key,
)
from schemas.time_tracker_subject import (
    TimeTrackerGoalOut,
    TimeTrackerProjectOut,
    TimeTrackerSubjectBackfillResult,
)

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


@router.post("/backfill", response_model=TimeTrackerSubjectBackfillResult)
async def backfill_time_tracker_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Derive Goal/Project rows from existing TimeTrackerEntry.subject_name
    (grouped by kind, case/whitespace-insensitively) and link each entry's
    goal_id/project_id to them. A project's parent goal (parent_goal_name)
    is backfilled into a Goal too, even if that goal never appears as its
    own kind="goal" entry.

    Safe to re-run: goals/projects are matched by name_key rather than
    recreated, and entries are only counted as newly linked when their FK
    actually changes.
    """

    entries = (
        db.query(TimeTrackerEntry)
        .filter(TimeTrackerEntry.user_id == current_user.id)
        .all()
    )

    goals_by_key: Dict[str, TimeTrackerGoal] = {
        g.name_key: g
        for g in db.query(TimeTrackerGoal).filter(
            TimeTrackerGoal.user_id == current_user.id
        )
    }
    projects_by_key: Dict[str, TimeTrackerProject] = {
        p.name_key: p
        for p in db.query(TimeTrackerProject).filter(
            TimeTrackerProject.user_id == current_user.id
        )
    }

    goals_created = 0
    projects_created = 0
    projects_linked_to_goal = 0
    entries_linked = 0

    def get_or_create_goal(name: str) -> TimeTrackerGoal:
        nonlocal goals_created
        key = normalize_name_key(name)
        goal = goals_by_key.get(key)
        if goal is None:
            goal = TimeTrackerGoal(user_id=current_user.id, name=name)
            db.add(goal)
            db.flush()
            goals_by_key[key] = goal
            goals_created += 1
        return goal

    def get_or_create_project(name: str) -> TimeTrackerProject:
        nonlocal projects_created
        key = normalize_name_key(name)
        project = projects_by_key.get(key)
        if project is None:
            project = TimeTrackerProject(user_id=current_user.id, name=name)
            db.add(project)
            db.flush()
            projects_by_key[key] = project
            projects_created += 1
        return project

    for entry in entries:
        subject_name = (entry.subject_name or "").strip()
        if not subject_name:
            continue

        if entry.kind == "goal":
            goal = get_or_create_goal(subject_name)
            if entry.goal_id != goal.id:
                entry.goal_id = goal.id
                entries_linked += 1
        elif entry.kind == "project":
            project = get_or_create_project(subject_name)
            parent_goal_name = (entry.parent_goal_name or "").strip()
            if parent_goal_name:
                goal = get_or_create_goal(parent_goal_name)
                if project.goal_id != goal.id:
                    project.goal_id = goal.id
                    projects_linked_to_goal += 1
            if entry.project_id != project.id:
                entry.project_id = project.id
                entries_linked += 1

    db.commit()

    return TimeTrackerSubjectBackfillResult(
        goals_created=goals_created,
        projects_created=projects_created,
        projects_linked_to_goal=projects_linked_to_goal,
        entries_linked=entries_linked,
    )
