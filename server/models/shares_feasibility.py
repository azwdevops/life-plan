"""DB model for shares feasibility workspace.

Generate the migration with Alembic (do not hand-edit existing revision files), e.g.:

  cd server && alembic revision --autogenerate -m "add shares feasibility workspace"

Expected table: shares_feasibility_workspaces (id, user_id UNIQUE FK users, state_json JSON, created_at, updated_at).
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.sql import func

from core.database import Base


class SharesFeasibilityWorkspace(Base):
    """One persisted workspace per user (opaque JSON matching client SharesFeasibilityState)."""

    __tablename__ = "shares_feasibility_workspaces"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    state_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
