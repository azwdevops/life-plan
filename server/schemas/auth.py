from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserSignup(BaseModel):
    email: EmailStr
    first_name: str
    password: str
    confirm_password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    is_active: bool
    groups: list[str] = []
    weight_kg: Optional[float] = None
    age: Optional[int] = None
    sex: Optional[Literal["male", "female", "other"]] = None
    height_cm: Optional[float] = None
    stats_refresh_interval_seconds: Optional[int] = None

    class Config:
        from_attributes = True


class UserFitnessProfilePut(BaseModel):
    """Replace stored fitness profile fields (omit or null clears a value)."""

    weight_kg: Optional[float] = None
    age: Optional[int] = None
    sex: Optional[Literal["male", "female", "other"]] = None
    height_cm: Optional[float] = None
    stats_refresh_interval_seconds: Optional[int] = None

    @field_validator("weight_kg")
    @classmethod
    def weight_range(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        if not (20 <= v <= 400):
            raise ValueError("weight_kg must be between 20 and 400")
        return v

    @field_validator("age")
    @classmethod
    def age_range(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if not (10 <= v <= 120):
            raise ValueError("age must be between 10 and 120")
        return v

    @field_validator("height_cm")
    @classmethod
    def height_range(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        if not (50 <= v <= 250):
            raise ValueError("height_cm must be between 50 and 250")
        return v

    @field_validator("stats_refresh_interval_seconds")
    @classmethod
    def stats_refresh_range(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if not (1 <= v <= 300):
            raise ValueError("stats_refresh_interval_seconds must be between 1 and 300")
        return v


class Token(BaseModel):
    access_token: str
    token_type: str


class GroupResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class SetUserGroupsRequest(BaseModel):
    group_names: list[str]

