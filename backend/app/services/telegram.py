import json
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.telegram import TelegramRepository
from app.schemas.telegram import TelegramSettingsUpdate


class TelegramService:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.repo = TelegramRepository(db)

    async def get_settings(self):
        return await self.repo.get_or_create(self.company_id)

    async def update_settings(self, data: TelegramSettingsUpdate):
        settings = await self.repo.get_or_create(self.company_id)
        if data.is_enabled is not None:
            settings.is_enabled = data.is_enabled
        if data.notification_events is not None:
            settings.notification_events = data.notification_events
        await self.db.commit()
        return settings

    async def generate_link_token(self, user_id: uuid.UUID, redis) -> str:
        """Generate a short-lived token for linking Telegram account."""
        token = str(uuid.uuid4()).replace("-", "")[:16]
        key = f"tg_link:{token}"
        await redis.setex(key, 600, str(user_id))  # 10 min TTL
        return token

    async def link_account(
        self,
        link_token: str,
        telegram_chat_id: str,
        telegram_username: str | None,
        redis,
        db: AsyncSession,
    ) -> bool:
        key = f"tg_link:{link_token}"
        user_id_str = await redis.get(key)
        if not user_id_str:
            return False

        from app.models.user import User
        from sqlalchemy import select

        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id_str))
        )
        user = result.scalar_one_or_none()
        if not user:
            return False

        user.telegram_chat_id = telegram_chat_id
        user.telegram_username = telegram_username
        await db.commit()
        await redis.delete(key)
        return True

    async def send_notification(
        self,
        redis,
        event_type: str,
        company_id: uuid.UUID,
        message: str,
    ) -> None:
        channel = f"notifications:{company_id}"
        payload = json.dumps({"event": event_type, "message": message})
        await redis.publish(channel, payload)
