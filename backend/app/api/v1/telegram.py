from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.core.exceptions import ForbiddenException
from app.database import get_db
from app.redis_client import get_redis
from app.schemas.telegram import (
    TelegramConnectResponse,
    TelegramSettingsResponse,
    TelegramSettingsUpdate,
)
from app.services.telegram import TelegramService
from app.config import settings

router = APIRouter(prefix="/telegram", tags=["Telegram"])


@router.get("/settings", response_model=TelegramSettingsResponse)
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    if current_user.company_id is None:
        raise ForbiddenException(
            "Telegram settings are scoped to a company. Superadmin has no company."
        )
    service = TelegramService(db, current_user.company_id)
    return await service.get_settings()


@router.put("/settings", response_model=TelegramSettingsResponse)
async def update_settings(
    data: TelegramSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_permission("manage_users")),
):
    if current_user.company_id is None:
        raise ForbiddenException(
            "Telegram settings are scoped to a company. Superadmin has no company."
        )
    service = TelegramService(db, current_user.company_id)
    return await service.update_settings(data)


@router.post("/connect", response_model=TelegramConnectResponse)
async def get_connect_token(
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
    current_user=Depends(get_current_user),
):
    service = TelegramService(db, current_user.company_id)
    token = await service.generate_link_token(current_user.id, redis)

    return TelegramConnectResponse(
        link_token=token,
        bot_username=None,  # Set once bot is configured
        instructions=(
            f"Send this command to the bot: /connect {token}\n"
            "The token is valid for 10 minutes."
        ),
    )


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    """Receive updates from Telegram (used when webhook mode is active)."""
    try:
        data = await request.json()
        # Process message for /connect command
        message = data.get("message", {})
        text = message.get("text", "")
        chat_id = str(message.get("chat", {}).get("id", ""))
        username = message.get("from", {}).get("username")

        if text.startswith("/connect "):
            token = text.split(" ", 1)[1].strip()
            service = TelegramService(db, None)
            success = await service.link_account(token, chat_id, username, redis, db)
            return {"ok": True, "linked": success}

        return {"ok": True}
    except Exception:
        return {"ok": True}
