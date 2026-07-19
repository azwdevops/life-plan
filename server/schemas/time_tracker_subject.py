from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TimeTrackerSubjectBackfillResult(BaseModel):
    goals_created: int
    projects_created: int
    projects_linked_to_goal: int
    entries_linked: int


class TimeTrackerGoalOut(BaseModel):
    id: int
    name: str
    end_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimeTrackerProjectOut(BaseModel):
    id: int
    name: str
    goal_id: Optional[int] = None

    class Config:
        from_attributes = True
