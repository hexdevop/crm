from pydantic import BaseModel, EmailStr, field_validator
from app.core.security import is_strong_password


class RegisterRequest(BaseModel):
    company_name: str
    company_slug: str
    first_name: str
    last_name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not is_strong_password(v):
            error_msg = "Password must be 8-128 characters with uppercase, lowercase, and digit"
            if len(v.encode("utf-8")) > 128:
                error_msg = "Password is too long (max 128 characters)"
            raise ValueError(error_msg)
        return v

    @field_validator("company_slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        import re
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must contain only lowercase letters, digits, and hyphens")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
