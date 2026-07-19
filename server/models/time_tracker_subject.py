"""Goal/Project entities for time tracking.

These rows are derived from `TimeTrackerEntry.subject_name`/`kind` via a
one-time backfill (see api/v1/endpoints/time_tracker_subjects.py) rather than
being the client's source of truth today — the client still creates and
lists goals/projects via localStorage. This table exists so
`TimeTrackerEntry` can eventually carry a real FK instead of a loose
`subject_id`/`subject_name` string pair.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func

from core.database import Base


def normalize_name_key(name: str) -> str:
    """Case/whitespace-insensitive key so 'Test', 'test', ' teSt ' collide."""
    return " ".join(name.strip().lower().split())


class CaseInsensitiveNamedMixin:
    """Reusable `name` + auto-maintained `name_key` pair for entities that
    must be unique per user regardless of case/whitespace differences.
    Pair `name_key` with a `UniqueConstraint("user_id", "name_key")` on the
    concrete model."""

    name = Column(String(512), nullable=False)
    name_key = Column(String(512), nullable=False)

    @validates("name")
    def _sync_name_key(self, _key, value):
        self.name_key = normalize_name_key(value)
        return value


class TimeTrackerGoal(CaseInsensitiveNamedMixin, Base):
    __tablename__ = "time_tracker_goals"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "name_key", name="uq_time_tracker_goals_user_name_key"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    projects = relationship("TimeTrackerProject", back_populates="goal")


class TimeTrackerProject(CaseInsensitiveNamedMixin, Base):
    __tablename__ = "time_tracker_projects"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "name_key", name="uq_time_tracker_projects_user_name_key"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    goal_id = Column(
        Integer,
        ForeignKey("time_tracker_goals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    goal = relationship("TimeTrackerGoal", back_populates="projects")
