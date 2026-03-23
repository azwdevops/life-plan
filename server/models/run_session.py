from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class RunSession(Base):
    __tablename__ = "run_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    speed_kmh = Column(Numeric(6, 2), nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    tick_interval_seconds = Column(Integer, nullable=False)
    distance_km = Column(Numeric(12, 4), nullable=False)
    calories_kcal = Column(Numeric(14, 4), nullable=False)
    fat_equiv_kg = Column(Numeric(14, 6), nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="run_sessions")
