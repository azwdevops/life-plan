from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from core.database import Base


class DailyProductiveItem(Base):
    __tablename__ = "daily_productive_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(64), nullable=False)
    item_date = Column(Date, nullable=False, index=True)
    text = Column(String(500), nullable=False)
    is_done = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
