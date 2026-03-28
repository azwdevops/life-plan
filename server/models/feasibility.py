from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class FeasibilityProject(Base):
    __tablename__ = "feasibility_projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    line_items = relationship(
        "FeasibilityLineItem",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="FeasibilityLineItem.sort_order",
    )


class FeasibilityLineItem(Base):
    __tablename__ = "feasibility_line_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("feasibility_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label = Column(String, nullable=False)
    unit_cost = Column(Numeric(18, 2), nullable=False, default=0)
    quantity = Column(Integer, nullable=False, default=1)
    sort_order = Column(Integer, nullable=False, default=0)

    project = relationship("FeasibilityProject", back_populates="line_items")
