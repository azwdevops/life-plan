from typing import Any

from pydantic import BaseModel, Field


class GameSaveOut(BaseModel):
    state: dict[str, Any] = Field(description="Full Investment Game state payload")


class GameSavePut(BaseModel):
    state: dict[str, Any] = Field(description="Full Investment Game state payload to persist")
