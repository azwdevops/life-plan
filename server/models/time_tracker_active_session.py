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


class TimeTrackerActiveSession(Base):
    __tablename__ = "time_tracker_active_sessions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", name="uq_time_tracker_active_sessions_user_id"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(String(16), nullable=False)
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
    # Frozen at start time, same as subject_name below - carried as-is into
    # the TimeTrackerEntry this session becomes on stop/replace, so later
    # recategorizing the project doesn't rewrite this session's history.
    category_id = Column(
        Integer,
        ForeignKey("time_tracker_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category_name = Column(String(512), nullable=True)
    subject_name = Column(String(512), nullable=False)
    parent_goal_id = Column(String(512), nullable=True)
    parent_goal_name = Column(String(512), nullable=True)
    description = Column(Text, nullable=False, default="")
    started_at = Column(DateTime(timezone=True), nullable=False)
    accumulated_pause_ms = Column(Integer, nullable=False, default=0)
    pause_started_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
