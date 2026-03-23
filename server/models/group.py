from sqlalchemy import Column, Integer, String, Table, ForeignKey
from sqlalchemy.orm import relationship

from core.database import Base

# Composite PK enforces one row per (user_id, group_id); no extra UniqueConstraint
# (avoids autogenerate trying to recreate uq_user_groups_user_group).
user_groups = Table(
    "user_groups",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, nullable=False, index=True)

    users = relationship(
        "User",
        secondary=user_groups,
        back_populates="groups",
    )
