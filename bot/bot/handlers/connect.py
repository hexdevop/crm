import httpx
from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from bot.config import settings

router = Router()


@router.message(Command("connect"))
async def cmd_connect(message: Message):
    parts = message.text.split() if message.text else []
    if len(parts) < 2:
        await message.answer(
            "❌ Укажите токен:\n<code>/connect ВАШ_ТОКЕН</code>\n\n"
            "Получить токен: CRM → Настройки → Telegram"
        )
        return

    token = parts[1].strip()
    chat_id = str(message.chat.id)
    username = message.from_user.username if message.from_user else None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.BACKEND_INTERNAL_URL}/api/v1/telegram/webhook",
                json={
                    "message": {
                        "text": f"/connect {token}",
                        "chat": {"id": message.chat.id},
                        "from": {"username": username},
                    }
                },
            )
            data = resp.json()

        if data.get("linked"):
            await message.answer(
                "✅ <b>Аккаунт успешно привязан!</b>\n\n"
                "Теперь вы будете получать уведомления из CRM."
            )
        else:
            await message.answer(
                "❌ <b>Токен недействителен или истёк.</b>\n\n"
                "Сгенерируйте новый токен в настройках CRM."
            )
    except Exception as e:
        await message.answer(
            "⚠️ Ошибка подключения к серверу. Попробуйте позже."
        )
