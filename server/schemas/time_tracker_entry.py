from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class TimeTrackerEntryCreate(BaseModel):
    id: str = Field(..., max_length=64)
    kind: Literal["goal", "project"]
    subject_id: str
    subject_name: str
    parent_goal_id: Optional[str] = None
    parent_goal_name: Optional[str] = None
    description: str = ""
    started_at: datetime
    ended_at: datetime
    duration_ms: int


class TimeTrackerEntryResponse(BaseModel):
    id: str
    kind: Literal["goal", "project"]
    subject_id: str
    subject_name: str
    parent_goal_id: Optional[str] = None
    parent_goal_name: Optional[str] = None
    description: str
    started_at: datetime
    ended_at: datetime
    duration_ms: int

    class Config:
        from_attributes = True


class TimeTrackerEntryUpdate(BaseModel):
    kind: Optional[Literal["goal", "project"]] = None
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    parent_goal_id: Optional[str] = None
    parent_goal_name: Optional[str] = None
    description: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
