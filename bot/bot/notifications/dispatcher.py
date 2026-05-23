import asyncio
import json
import logging
import httpx
from aiogram import Bot
from redis.asyncio import Redis, ConnectionPool

from bot.config import settings

logger = logging.getLogger(__name__)

_DIVIDER = "─" * 20


class NotificationDispatcher:
    def __init__(self, bot: Bot):
        self.bot = bot
        self._redis: Redis | None = None

    async def _get_redis(self) -> Redis:
        if self._redis is None:
            pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)
            self._redis = Redis(connection_pool=pool)
        return self._redis

    async def _get_company_chat_ids(self, company_id: str) -> list[str]:
        """Fetch all telegram_chat_ids for active users of a company via secure internal endpoint."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{settings.BACKEND_INTERNAL_URL}/api/v1/users/internal/by-company/{company_id}",
                    headers={"X-Internal-Token": settings.INTERNAL_BOT_TOKEN},
                )
                if resp.status_code == 200:
                    users = resp.json()
                    return [
                        u["telegram_chat_id"]
                        for u in users
                        if u.get("telegram_chat_id") and u.get("is_active")
                    ]
        except Exception as e:
            logger.warning(f"Could not fetch company users for {company_id}: {e}")
        return []

    def _format_message(self, event: str, payload: dict) -> str:
        entity_name = payload.get("entity_name", "?")

        if event == "record_created":
            fields_data: dict = payload.get("fields_data", {})
            lines = [
                f"📝 <b>Новая запись создана</b>",
                f"<i>Сущность: {entity_name}</i>",
            ]
            if fields_data:
                lines.append(_DIVIDER)
                for name, value in fields_data.items():
                    lines.append(f"• <b>{name}:</b> {value}")
            return "\n".join(lines)

        if event == "record_updated":
            changes: dict = payload.get("changes", {})
            lines = [
                f"✏️ <b>Запись обновлена</b>",
                f"<i>Сущность: {entity_name}</i>",
            ]
            if changes:
                lines.append(_DIVIDER)
                for name, ch in changes.items():
                    lines.append(f"• <b>{name}:</b> {ch.get('old', '—')} → {ch.get('new', '—')}")
            else:
                lines.append("Данные не изменились")
            return "\n".join(lines)

        if event == "record_deleted":
            fields_data = payload.get("fields_data", {})
            lines = [
                f"🗑️ <b>Запись удалена</b>",
                f"<i>Сущность: {entity_name}</i>",
            ]
            if fields_data:
                lines.append(_DIVIDER)
                for name, value in fields_data.items():
                    lines.append(f"• <b>{name}:</b> {value}")
            return "\n".join(lines)

        if event == "user_assigned":
            return f"👤 <b>Назначен пользователь</b>\n{payload.get('message', '')}"

        if event == "access_expired":
            return f"⏰ <b>Истёк доступ</b>\n{payload.get('message', '')}"

        return f"ℹ️ {payload.get('message', str(payload))}"

    async def dispatch(self, channel: str, raw_message: str) -> None:
        try:
            payload = json.loads(raw_message)
        except json.JSONDecodeError:
            logger.warning(f"Invalid notification JSON: {raw_message[:100]}")
            return

        event = payload.get("event", "system")
        company_id = channel.replace("notifications:", "")

        text = self._format_message(event, payload)

        chat_ids = await self._get_company_chat_ids(company_id)
        for chat_id in chat_ids:
            try:
                await self.bot.send_message(chat_id, text, parse_mode="HTML")
            except Exception as e:
                logger.warning(f"Failed to send to {chat_id}: {e}")

    async def listen(self) -> None:
        """Subscribe to all notification channels via Redis pub/sub."""
        redis = await self._get_redis()
        pubsub = redis.pubsub()
        await pubsub.psubscribe("notifications:*")
        logger.info("Subscribed to notifications:* channels")

        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            channel = message.get("channel", "")
            data = message.get("data", "")
            if isinstance(data, str):
                asyncio.create_task(self.dispatch(channel, data))
