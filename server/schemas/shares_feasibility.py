from typing import Any

from pydantic import BaseModel, Field


class SharesFeasibilityWorkspaceOut(BaseModel):
    state: dict[str, Any] = Field(description="Full shares feasibility workspace payload")


class SharesFeasibilityWorkspacePut(BaseModel):
    state: dict[str, Any] = Field(description="Full shares feasibility workspace payload to persist")
