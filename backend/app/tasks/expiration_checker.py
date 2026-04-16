import logging

from app.database import AsyncSessionLocal
from app.redis_client import get_redis
from app.repositories.access_expiration import AccessExpirationRepository
from app.models.user import User
from app.services.telegram import TelegramService

logger = logging.getLogger(__name__)


async def check_and_block_expired_users():
    """
    Periodic task: find users with expired access and deactivate them.
    Runs every 5 minutes via APScheduler.
    """
    logger.info("Running access expiration check...")
    redis = await get_redis()

    async with AsyncSessionLocal() as db:
        try:
            repo = AccessExpirationRepository(db)
            expired = await repo.get_expired_active_users()

            if not expired:
                return

            blocked = 0
            for exp_record in expired:
                user = exp_record.user
                if not user or not user.is_active:
                    continue

                user.is_active = False
                exp_record.was_auto_blocked = True

                # Invalidate permission cache
                await redis.delete(f"perms:{user.id}")

                # Send Telegram notification
                try:
                    tg_service = TelegramService(db, user.company_id)
                    await tg_service.send_notification(
                        redis,
                        "access_expired",
                        user.company_id,
                        f"Доступ истёк: {user.full_name} ({user.email})",
                    )
                except Exception as e:
                    logger.warning(f"Failed to send Telegram notification: {e}")

                blocked += 1

            if blocked > 0:
                await db.commit()
                logger.info(f"Blocked {blocked} users with expired access")

        except Exception as e:
            logger.error(f"Error in expiration checker: {e}")
            await db.rollback()
