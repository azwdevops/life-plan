from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from core.database import Base


class AiScheduleJob(Base):
    """Background AI day-schedule generation job (OpenRouter). Run `alembic revision` to create the table."""

    __tablename__ = "ai_schedule_jobs"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(32), nullable=False)
    error_message = Column(Text, nullable=True)
    result_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
