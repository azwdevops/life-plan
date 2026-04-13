from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from core.database import Base


class DisciplineTrack(Base):
    """Per-user discipline counter row (label + signed integer count)."""

    __tablename__ = "discipline_tracks"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_discipline_tracks_user_client_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(64), nullable=False)
    label = Column(String(256), nullable=False)
    count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
