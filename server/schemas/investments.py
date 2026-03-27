from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PlotProspectStageBase(BaseModel):
    name: str


class PlotProspectStageCreate(PlotProspectStageBase):
    pass


class PlotProspectStageUpdate(PlotProspectStageBase):
    pass


class PlotProspectStageDeleteRequest(BaseModel):
    replacement_stage_id: Optional[int] = None


class PlotProspectStageResponse(PlotProspectStageBase):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlotProspectBase(BaseModel):
    stage_id: int
    name: str
    phones: list[str]
    dealer_name: Optional[str] = None
    location: str
    map_pin: Optional[str] = None
    plot_size: Optional[str] = None
    price: str


class PlotProspectCreate(PlotProspectBase):
    pass


class PlotProspectUpdate(PlotProspectBase):
    pass


class PlotProspectResponse(PlotProspectBase):
    id: int
    user_id: int
    stage_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
