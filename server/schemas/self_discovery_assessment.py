from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SelfDiscoveryAssessmentCard(BaseModel):
    test_id: str
    title: str
    tagline: str
    sort_order: int


class SelfDiscoveryAssessmentDetail(BaseModel):
    test_id: str
    title: str
    tagline: str
    questions_instruction_html: str
    analysis_instruction_html: str
    sort_order: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    llm_request_body_template: Optional[str] = Field(
        default=None,
        description="OpenRouter request JSON; {{name}} placeholders. AI schedule; null/empty in DB = server default.",
    )


class SelfDiscoveryAssessmentUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    tagline: str = Field(min_length=1)
    questions_instruction_html: str = Field(min_length=1)
    analysis_instruction_html: str = Field(min_length=1)
    sort_order: int = 0
    llm_request_body_template: Optional[str] = None
