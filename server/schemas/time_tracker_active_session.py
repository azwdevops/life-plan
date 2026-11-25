from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

from schemas.time_tracker_entry import TimeTrackerEntryResponse


class TimeTrackerActiveSessionOut(BaseModel):
    kind: Literal["goal", "project"]
    goal_id: Optional[int] = None
    project_id: Optional[int] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    subject_name: str
    parent_goal_id: Optional[str] = None
    parent_goal_name: Optional[str] = None
    description: str
    started_at: datetime
    accumulated_pause_ms: int
    pause_started_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimeTrackerActiveSessionStart(BaseModel):
    kind: Literal["goal", "project"]
    goal_id: Optional[int] = None
    project_id: Optional[int] = None
    subject_name: str
    parent_goal_id: Optional[str] = None
    parent_goal_name: Optional[str] = None
    description: str = ""


class TimeTrackerActiveSessionStartResponse(BaseModel):
    active_session: TimeTrackerActiveSessionOut
    auto_closed_entry: Optional[TimeTrackerEntryResponse] = None


class TimeTrackerActiveSessionUpdate(BaseModel):
    action: Optional[Literal["pause", "resume"]] = None
    description: Optional[str] = None
