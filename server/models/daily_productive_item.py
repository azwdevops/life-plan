from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class DailyProductiveTemplate(Base):
    """A recurring item: on each weekday in `days`, a DailyProductiveItem is
    auto-created for that date (if one doesn't already exist for it)."""

    __tablename__ = "daily_productive_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String(500), nullable=False)
    # Comma-separated weekday keys, e.g. "mon,tue,thu"
    days = Column(String(40), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DailyProductiveItem(Base):
    __tablename__ = "daily_productive_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(64), nullable=False)
    item_date = Column(Date, nullable=False, index=True)
    text = Column(String(500), nullable=False)
    is_done = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)
    # Set when auto-created from a DailyProductiveTemplate; SET NULL on the
    # template's deletion so already-created items are kept, just no longer
    # linked to a (now gone) recurrence rule.
    template_id = Column(
        Integer, ForeignKey("daily_productive_templates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    template = relationship("DailyProductiveTemplate")
