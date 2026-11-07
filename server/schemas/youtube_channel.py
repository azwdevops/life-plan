from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel


class YoutubeOAuthAuthorizeOut(BaseModel):
    """URL to send the browser to for the Google consent screen."""

    url: str


class YoutubeChannelStatOut(BaseModel):
    id: int
    subscriber_count: int
    view_count: int
    video_count: int
    watch_time_hours: Optional[float] = None
    month_to_date_views: Optional[int] = None
    synced_at: datetime

    class Config:
        from_attributes = True


class YoutubeChannelOut(BaseModel):
    id: int
    account_id: int
    youtube_channel_id: str
    title: str
    thumbnail_url: Optional[str] = None
    is_monetized: bool
    estimated_rpm: Optional[float] = None
    studio_url: str
    latest_stat: Optional[YoutubeChannelStatOut] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class YoutubeAccountOut(BaseModel):
    id: int
    google_email: str
    group_label: Optional[str] = None
    channels: list[YoutubeChannelOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


class YoutubeChannelUpdate(BaseModel):
    """Both fields optional/independent - the monetized toggle and RPM estimate
    are edited from separate controls in the UI (the toggle behind a confirm dialog)."""

    is_monetized: Optional[bool] = None
    estimated_rpm: Optional[float] = None


class YoutubeAccountUpdate(BaseModel):
    """Set to a name to group this account with others sharing the same label
    (displayed together in the UI); set to null/empty to ungroup it."""

    group_label: Optional[str] = None


class YoutubePostingTimeOut(BaseModel):
    """The recurring posting-time window for one weekday - unrelated to any
    specific week, so it has no date. See YoutubeUploadLogOut for the
    per-date videos-uploaded count."""

    id: int
    channel_id: int
    day_of_week: str
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class YoutubePostingTimeUpsert(BaseModel):
    """Both fields optional/independent - the start and end time controls in
    the UI can each be added/edited on their own."""

    start_time: Optional[time] = None
    end_time: Optional[time] = None


class YoutubeUploadLogOut(BaseModel):
    """Videos-uploaded count for one channel on one specific calendar date -
    never reused across weeks, unlike the day-of-week posting schedule."""

    id: int
    channel_id: int
    upload_date: date
    videos_uploaded_count: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class YoutubeUploadLogUpsert(BaseModel):
    videos_uploaded_count: int
