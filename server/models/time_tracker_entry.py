from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from core.database import Base


class TimeTrackerEntry(Base):
    __tablename__ = "time_tracker_entries"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "client_entry_id",
            name="uq_time_tracker_entries_user_client_id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_entry_id = Column(String(64), nullable=False)
    kind = Column(String(16), nullable=False)
    subject_id = Column(String(512), nullable=False)
    subject_name = Column(String(512), nullable=False)
    parent_goal_id = Column(String(512), nullable=True)
    parent_goal_name = Column(String(512), nullable=True)
    # Real FKs, backfilled from subject_name/kind (see
    # api/v1/endpoints/time_tracker_subjects.py). Nullable/additive alongside
    # the legacy subject_id/subject_name strings above, not a replacement.
    goal_id = Column(
        Integer,
        ForeignKey("time_tracker_goals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    project_id = Column(
        Integer,
        ForeignKey("time_tracker_projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    description = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ended_at = Column(DateTime(timezone=True), nullable=False)
    duration_ms = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
