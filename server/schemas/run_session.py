from datetime import datetime

from pydantic import BaseModel, Field


class RunSessionStart(BaseModel):
    speed_kmh: float = Field(gt=0, le=80)
    tick_interval_seconds: int = Field(default=3, ge=1, le=300)


class RunSessionComplete(BaseModel):
    duration_seconds: int = Field(gt=0, le=86400 * 7)
    tick_interval_seconds: int = Field(ge=1, le=300)


class RunSessionResponse(BaseModel):
    id: int
    user_id: int
    speed_kmh: float
    duration_seconds: int
    tick_interval_seconds: int
    distance_km: float
    calories_kcal: float
    fat_equiv_kg: float
    is_completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
