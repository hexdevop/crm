import uuid
from typing import Any
from pydantic import BaseModel


class TelegramSettingsUpdate(BaseModel):
    is_enabled: bool | None = None
    notification_events: dict[str, Any] | None = None


class TelegramSettingsResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    is_enabled: bool
    notification_events: dict[str, Any]


class TelegramConnectResponse(BaseModel):
    link_token: str
    bot_username: str | None
    instructions: str
