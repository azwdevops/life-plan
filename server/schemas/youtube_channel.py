from datetime import datetime
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
    channels: list[YoutubeChannelOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


class YoutubeChannelUpdate(BaseModel):
    """Both fields optional/independent - the monetized toggle and RPM estimate
    are edited from separate controls in the UI (the toggle behind a confirm dialog)."""

    is_monetized: Optional[bool] = None
    estimated_rpm: Optional[float] = None
