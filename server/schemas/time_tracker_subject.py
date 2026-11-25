from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TimeTrackerGoalOut(BaseModel):
    id: int
    name: str
    end_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimeTrackerGoalCreate(BaseModel):
    name: str
    end_date: Optional[datetime] = None


class TimeTrackerGoalUpdate(BaseModel):
    name: Optional[str] = None
    end_date: Optional[datetime] = None


class TimeTrackerProjectOut(BaseModel):
    id: int
    name: str
    goal_id: Optional[int] = None
    category_id: Optional[int] = None

    class Config:
        from_attributes = True


class TimeTrackerProjectCreate(BaseModel):
    name: str
    goal_id: Optional[int] = None
    category_id: Optional[int] = None


class TimeTrackerProjectUpdate(BaseModel):
    name: Optional[str] = None
    goal_id: Optional[int] = None
    category_id: Optional[int] = None


class TimeTrackerCategoryOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class TimeTrackerCategoryCreate(BaseModel):
    name: str


class TimeTrackerCategoryUpdate(BaseModel):
    name: Optional[str] = None
