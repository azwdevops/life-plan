"""Self-discovery assessment definitions (title, tagline, TipTap HTML instructions).

Alembic: import model then autogenerate; do not hand-edit existing revision files.

Table: self_discovery_assessments.
"""

from sqlalchemy import Column, DateTime, Integer, String, Text, func

from core.database import Base


class SelfDiscoveryAssessment(Base):
    """One assessment; test_id matches URL segment (e.g. self_esteem)."""

    __tablename__ = "self_discovery_assessments"

    test_id = Column(String(64), primary_key=True)
    title = Column(String(255), nullable=False)
    tagline = Column(Text, nullable=False)
    questions_instruction_html = Column(Text, nullable=False)
    analysis_instruction_html = Column(Text, nullable=False)
    # Optional OpenRouter /chat/completions JSON; {{name}} substitution (AI schedule).
    llm_request_body_template = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
