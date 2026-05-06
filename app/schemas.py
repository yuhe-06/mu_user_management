from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    permissions: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserBase(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=1, max_length=255)
    edu_email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization_name: Optional[str] = None
    permissions: Optional[str] = "research"
    permissions_new: Optional[str] = None
    query_limit: Optional[int] = Field(default=100, ge=0, le=150)
    teams_email_reg: Optional[str] = None
    subscribe_start_at: Optional[datetime] = None
    subscribe_end_at: Optional[datetime] = None


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[str] = Field(default=None, min_length=1, max_length=255)
    edu_email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization_name: Optional[str] = None
    permissions: Optional[str] = None
    permissions_new: Optional[str] = None
    query_limit: Optional[int] = Field(default=None, ge=0, le=150)
    teams_email_reg: Optional[str] = None
    subscribe_start_at: Optional[datetime] = None
    subscribe_end_at: Optional[datetime] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)


class UserRead(BaseModel):
    id: int
    username: Optional[str] = None
    email: Optional[str] = None
    edu_email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization_name: Optional[str] = None
    permissions: Optional[str] = None
    permissions_new: Optional[str] = None
    query_limit: Optional[int] = None
    teams_email_reg: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted: Optional[bool] = False
    subscribe_start_at: Optional[datetime] = None
    subscribe_end_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at", "subscribe_start_at", "subscribe_end_at")
    def serialize_datetime(self, value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None


class UserListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    data: list[UserRead]
