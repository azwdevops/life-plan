from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class PendingWorkCategory(Base):
    __tablename__ = "pending_work_categories"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_pending_work_categories_user_client_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(64), nullable=False)
    name = Column(String(256), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship(
        "PendingWorkItem",
        back_populates="category",
        cascade="all, delete-orphan",
    )


class PendingWorkItem(Base):
    __tablename__ = "pending_work_items"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_pending_work_items_user_client_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(64), nullable=False)
    category_id = Column(
        Integer,
        ForeignKey("pending_work_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    category = relationship("PendingWorkCategory", back_populates="items")
