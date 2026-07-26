from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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
