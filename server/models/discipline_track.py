from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from core.database import Base


class DisciplineTrack(Base):
    """Stable per-user discipline category."""

    __tablename__ = "discipline_tracks"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_discipline_tracks_user_client_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(64), nullable=False)
    label = Column(String(256), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DisciplineTrackDailyCount(Base):
    """Per-day signed counter for a discipline category."""

    __tablename__ = "discipline_track_daily_counts"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "track_id",
            "tracked_on",
            name="uq_discipline_track_daily_counts_user_track_date",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("discipline_tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    tracked_on = Column(Date, nullable=False, index=True)
    count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
