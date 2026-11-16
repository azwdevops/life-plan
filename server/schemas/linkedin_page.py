from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel


class LinkedinPageOut(BaseModel):
    id: int
    name: str
    is_paused: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LinkedinPageCreate(BaseModel):
    name: str


class LinkedinPageUpdate(BaseModel):
    """Both fields optional/independent - the name and pause flag are each
    edited from separate controls in the UI."""

    name: Optional[str] = None
    is_paused: Optional[bool] = None


class LinkedinPostingTimeOut(BaseModel):
    """The recurring posting-time window for one weekday - unrelated to any
    specific week, so it has no date. See LinkedinPostLogOut for the
    per-date posts-count."""

    id: int
    page_id: int
    day_of_week: str
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_posting_day: bool = True
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LinkedinPostingTimeUpsert(BaseModel):
    """All fields optional/independent - the start/end time controls and the
    posting-day toggle in the UI can each be changed on their own."""

    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_posting_day: Optional[bool] = None


class LinkedinPostLogOut(BaseModel):
    """Posts-count for one page on one specific calendar date - never reused
    across weeks, unlike the day-of-week posting schedule."""

    id: int
    page_id: int
    post_date: date
    posts_count: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LinkedinPostLogUpsert(BaseModel):
    posts_count: int
