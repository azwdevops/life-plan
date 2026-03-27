from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ResumeDocumentUpsert(BaseModel):
    """Body for PUT /resumes/{external_id}; matches client NamedResumeDocument (camelCase)."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    resume: dict[str, Any]
    cover_letter: dict[str, Any] = Field(alias="coverLetter")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class ResumeListResponse(BaseModel):
    documents: list[dict[str, Any]]
