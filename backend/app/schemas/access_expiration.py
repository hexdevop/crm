import uuid
from datetime import datetime
from pydantic import BaseModel


class AccessExpirationCreate(BaseModel):
    user_id: uuid.UUID
    expires_at: datetime


class AccessExpirationUpdate(BaseModel):
    expires_at: datetime


class AccessExpirationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    company_id: uuid.UUID
    expires_at: datetime
    is_notified: bool
    was_auto_blocked: bool
    created_at: datetime
    updated_at: datetime
