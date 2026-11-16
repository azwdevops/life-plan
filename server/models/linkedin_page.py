"""LinkedIn posting tracker: manually-named pages/profiles (no OAuth - just a
label the user types in, unlike the YouTube feature's connected accounts),
each with the same recurring per-weekday posting-time/posting-day schedule
and per-date post-count log as the YouTube channel tracker.

Alembic: run your own revision to create these tables.
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class LinkedinPage(Base):
    """A LinkedIn page or profile being tracked - just a user-entered name,
    with no live API connection."""

    __tablename__ = "linkedin_pages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    # One-flag "pause this whole page" - deliberately separate from each
    # LinkedinPagePostingTime row's is_posting_day, so resuming restores
    # exactly whatever per-weekday pattern existed before pausing instead of
    # turning every day back on.
    is_paused = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    posting_times = relationship(
        "LinkedinPagePostingTime",
        back_populates="page",
        cascade="all, delete-orphan",
    )
    post_logs = relationship(
        "LinkedinPagePostLog",
        back_populates="page",
        cascade="all, delete-orphan",
    )


class LinkedinPagePostingTime(Base):
    """User-set best-time-to-post window for one weekday, and whether this
    page is expected to post on that weekday at all (no row, or
    is_posting_day true, means "yes" - every page posts every day by
    default). Mirrors YoutubeChannelPostingTime."""

    __tablename__ = "linkedin_page_posting_times"
    __table_args__ = (
        UniqueConstraint("page_id", "day_of_week", name="uq_linkedin_posting_times_page_day"),
    )

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(
        Integer, ForeignKey("linkedin_pages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_of_week = Column(String(9), nullable=False)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    is_posting_day = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    page = relationship("LinkedinPage", back_populates="posting_times")


class LinkedinPagePostLog(Base):
    """Posts-published count for one page on one specific calendar date - the
    count logged for "this week's Monday" is a different row than "last
    week's Monday". Mirrors YoutubeChannelUploadLog."""

    __tablename__ = "linkedin_page_post_logs"
    __table_args__ = (
        UniqueConstraint("page_id", "post_date", name="uq_linkedin_post_logs_page_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(
        Integer, ForeignKey("linkedin_pages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    post_date = Column(Date, nullable=False, index=True)
    posts_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    page = relationship("LinkedinPage", back_populates="post_logs")
