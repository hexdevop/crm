import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel


class EntityRecordCreate(BaseModel):
    data: dict[str, Any]


class EntityRecordUpdate(BaseModel):
    data: dict[str, Any]


class EntityRecordResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    entity_id: uuid.UUID
    company_id: uuid.UUID
    created_by: uuid.UUID | None
    data: dict[str, Any]
    created_at: datetime
    updated_at: datetime
