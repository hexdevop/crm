import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.core.security import is_strong_password


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not is_strong_password(v):
            error_msg = "Password must be 8-128 characters with uppercase, lowercase, and digit"
            if len(v.encode("utf-8")) > 128:
                error_msg = "Password is too long (max 128 characters)"
            raise ValueError(error_msg)
        return v


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None


class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not is_strong_password(v):
            error_msg = "Password must be 8-128 characters with uppercase, lowercase, and digit"
            if len(v.encode("utf-8")) > 128:
                error_msg = "Password is too long (max 128 characters)"
            raise ValueError(error_msg)
        return v


class RoleShortResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    system_type: str | None


class CompanyShort(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    slug: str


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID | None = None
    email: str
    first_name: str
    last_name: str
    full_name: str
    is_active: bool
    is_superadmin: bool
    telegram_chat_id: str | None
    telegram_username: str | None
    roles: list[RoleShortResponse] = []
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_with_roles(cls, user) -> "UserResponse":
        roles = [
            RoleShortResponse.model_validate(ur.role)
            for ur in (user.user_roles or [])
            if ur.role
        ]
        data = {
            "id": user.id,
            "company_id": user.company_id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_superadmin": user.is_superadmin,
            "telegram_chat_id": user.telegram_chat_id,
            "telegram_username": user.telegram_username,
            "roles": roles,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
        return cls(**data)


class MeResponse(UserResponse):
    permissions: list[str] = []
    company: CompanyShort | None = None
