import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.config import settings
from bot.handlers.start import router as start_router
from bot.handlers.connect import router as connect_router
from bot.notifications.dispatcher import NotificationDispatcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


async def main():
    if not settings.BOT_TOKEN or settings.BOT_TOKEN == "your-telegram-bot-token":
        logger.warning("BOT_TOKEN not set — Telegram bot will not start")
        # Keep running anyway so container doesn't crash
        await asyncio.sleep(3600)
        return

    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(start_router)
    dp.include_router(connect_router)

    # Start Redis notification listener
    notif_dispatcher = NotificationDispatcher(bot)
    asyncio.create_task(notif_dispatcher.listen())

    logger.info("Starting CRM bot (polling mode)...")
    await dp.start_polling(bot, allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    asyncio.run(main())
