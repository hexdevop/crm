import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator
import re


class CompanyCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.lower()
        if not re.match(r"^[a-zа-яё0-9-]+$", v):
            raise ValueError("Slug must contain only lowercase letters (latin or cyrillic), digits, and hyphens")
        return v


class CompanyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    logo_url: str | None = None


class CompanyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    logo_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
