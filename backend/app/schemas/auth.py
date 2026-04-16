from pydantic import BaseModel, EmailStr, field_validator, TypeAdapter
from app.core.security import is_strong_password
from app.config import settings


def validate_email_with_superadmin(v: str) -> str:
    """Валидирует email, делая исключение для суперадмина с доменом .local"""
    v = v.lower()
    if v == settings.SUPERADMIN_EMAIL.lower():
        return v
    try:
        return str(TypeAdapter(EmailStr).validate_python(v))
    except Exception:
        raise ValueError("Invalid email address")


class RegisterRequest(BaseModel):
    company_name: str
    company_slug: str
    first_name: str
    last_name: str
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return validate_email_with_superadmin(v)

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
        v = v.lower()
        if not re.match(r"^[a-zа-яё0-9-]+$", v):
            raise ValueError("Slug must contain only lowercase letters (latin or cyrillic), digits, and hyphens")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return validate_email_with_superadmin(v)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
