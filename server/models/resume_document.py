from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.sql import func

from core.database import Base


class ResumeDocument(Base):
    __tablename__ = "resume_documents"
    __table_args__ = (
        UniqueConstraint("user_id", "external_id", name="uq_resume_doc_user_external"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    external_id = Column(String(40), nullable=False)
    name = Column(String(512), nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
