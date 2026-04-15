from aiogram import Router
from aiogram.filters import CommandStart, Command
from aiogram.types import Message

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(
        "👋 <b>Добро пожаловать в CRM Bot!</b>\n\n"
        "Этот бот отправляет уведомления из вашей CRM системы.\n\n"
        "Для подключения:\n"
        "1. Войдите в CRM → Настройки → Telegram\n"
        "2. Нажмите «Получить токен подключения»\n"
        "3. Отправьте сюда: <code>/connect ВАШ_ТОКЕН</code>"
    )


@router.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "📚 <b>Доступные команды:</b>\n\n"
        "/start — начать работу\n"
        "/connect [токен] — привязать аккаунт CRM\n"
        "/help — помощь"
    )
