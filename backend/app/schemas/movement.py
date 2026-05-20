import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


MovementTypeStr = Literal["receipt", "expenditure", "write_off"]


class MovementCreate(BaseModel):
    movement_type: MovementTypeStr
    quantity: float = Field(gt=0)
    unit: str | None = None
    notes: str | None = None
    reference_number: str | None = None
    performed_at: datetime | None = None


class MovementResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    entity_id: uuid.UUID
    record_id: uuid.UUID
    movement_type: str
    quantity: float
    unit: str | None
    notes: str | None
    reference_number: str | None
    performed_by: uuid.UUID | None
    performed_at: datetime
    created_at: datetime


class MovementBalance(BaseModel):
    receipt: float
    expenditure: float
    write_off: float
    balance: float
    unit: str | None
