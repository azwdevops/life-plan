from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

from models.group import user_groups


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    # Fitness / energy-expenditure estimates (optional; user-maintained)
    weight_kg = Column(Numeric(5, 2), nullable=True)
    age = Column(Integer, nullable=True)
    sex = Column(String(16), nullable=True)  # male | female | other
    height_cm = Column(Numeric(5, 2), nullable=True)
    # Running MET multiplier for kcal estimates; optional, defaults to 1.0 in calculations.
    running_met = Column(Numeric(4, 2), nullable=True)
    # How often live run stats refresh (seconds); optional, client defaults to 3.
    stats_refresh_interval_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    groups = relationship(
        "Group",
        secondary=user_groups,
        back_populates="users",
    )
    run_sessions = relationship("RunSession", back_populates="user")

