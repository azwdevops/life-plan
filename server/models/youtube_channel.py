"""YouTube channel management: connected Google accounts, their channels, and
per-sync stat snapshots (subscriber/view/watch-time history for the growth chart).

One `YoutubeAccount` per connected Gmail account (its own OAuth token pair);
one `YoutubeChannel` per YouTube channel that account owns; one
`YoutubeChannelStat` row per manual "Sync" click, so the growth chart is just
that channel's stats ordered by `synced_at`.

Alembic: run your own revision to create these tables.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class YoutubeAccount(Base):
    """A connected Google account (its OAuth tokens), grouping 1+ YouTube channels."""

    __tablename__ = "youtube_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "google_email", name="uq_youtube_accounts_user_email"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    google_email = Column(String(255), nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    token_expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    channels = relationship(
        "YoutubeChannel",
        back_populates="account",
        cascade="all, delete-orphan",
        order_by="YoutubeChannel.title",
    )


class YoutubeChannel(Base):
    __tablename__ = "youtube_channels"
    __table_args__ = (
        UniqueConstraint("youtube_channel_id", name="uq_youtube_channels_channel_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(
        Integer, ForeignKey("youtube_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    youtube_channel_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    thumbnail_url = Column(Text, nullable=True)
    # No public API reports monetization status - manually toggled, off by default.
    is_monetized = Column(Boolean, nullable=False, default=False)
    # User-set revenue-per-mille estimate; paired with month_to_date_views for a
    # rough earnings estimate. Real ad revenue isn't available via the public API.
    estimated_rpm = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    account = relationship("YoutubeAccount", back_populates="channels")
    stats = relationship(
        "YoutubeChannelStat",
        back_populates="channel",
        cascade="all, delete-orphan",
        order_by="YoutubeChannelStat.synced_at",
    )


class YoutubeChannelStat(Base):
    """One snapshot per manual sync - the only history we have, per the user's spec."""

    __tablename__ = "youtube_channel_stats"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(
        Integer, ForeignKey("youtube_channels.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscriber_count = Column(Integer, nullable=False, default=0)
    view_count = Column(Integer, nullable=False, default=0)
    video_count = Column(Integer, nullable=False, default=0)
    watch_time_hours = Column(Float, nullable=True)
    month_to_date_views = Column(Integer, nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    channel = relationship("YoutubeChannel", back_populates="stats")
