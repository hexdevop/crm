import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, field_validator
import re


class EntityFieldCreate(BaseModel):
    name: str
    slug: str
    field_type: str
    is_required: bool = False
    is_searchable: bool = True
    position: int = 0
    config: dict[str, Any] | None = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9_]+$", v):
            raise ValueError("Slug must contain only lowercase letters, digits, and underscores")
        return v

    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, v: str) -> str:
        v = v.lower()
        allowed = {"text", "number", "date", "boolean", "select", "email", "phone"}
        if v not in allowed:
            raise ValueError(f"field_type must be one of: {', '.join(allowed)}")
        return v


class EntityFieldUpdate(BaseModel):
    name: str | None = None
    is_required: bool | None = None
    is_searchable: bool | None = None
    position: int | None = None
    config: dict[str, Any] | None = None


class EntityFieldReorder(BaseModel):
    field_ids: list[uuid.UUID]


class EntityFieldResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    entity_id: uuid.UUID
    name: str
    slug: str
    field_type: str
    is_required: bool
    is_searchable: bool
    position: int
    config: dict[str, Any] | None


class EntityCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    fields: list[EntityFieldCreate] = []

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must contain only lowercase letters, digits, and hyphens")
        return v

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v and not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("Color must be a valid hex color (e.g. #3B82F6)")
        return v


class EntityUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None


class EntityResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    slug: str
    description: str | None
    icon: str | None
    color: str | None
    fields: list[EntityFieldResponse] = []
    record_count: int = 0
    created_at: datetime
    updated_at: datetime
