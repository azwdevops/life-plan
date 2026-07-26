"""DB model for the Investment Game save.

Generate the migration with Alembic (do not hand-edit existing revision files), e.g.:

  cd server && alembic revision --autogenerate -m "add investment game save"

Expected table: game_saves (id, user_id UNIQUE FK users, state_json JSON, created_at, updated_at).
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.sql import func

from core.database import Base


class GameSave(Base):
    """One persisted save per user (opaque JSON matching client GameState)."""

    __tablename__ = "game_saves"

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
