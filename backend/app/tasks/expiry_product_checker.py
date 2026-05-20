import logging
from datetime import date, timedelta, timezone, datetime

from app.database import AsyncSessionLocal
from app.redis_client import get_redis
from app.services.telegram import TelegramService

logger = logging.getLogger(__name__)

# Field type name for expiry dates
EXPIRY_FIELD_TYPE = "expiry_date"


async def check_expiring_products():
    """
    Periodic task: scan entity_records with expiry_date fields.
    Sends Telegram notification for records expiring within warn_days.
    Runs once per day.
    """
    logger.info("Running expiry product check...")
    redis = await get_redis()
    today = date.today()

    async with AsyncSessionLocal() as db:
        try:
            from sqlalchemy import select, text
            from app.models.entity import Entity, EntityField
            from app.models.entity_record import EntityRecord

            # Get all expiry_date fields across all entities
            fields_result = await db.execute(
                select(EntityField).where(EntityField.field_type == EXPIRY_FIELD_TYPE)
            )
            fields = fields_result.scalars().all()

            if not fields:
                return

            for field in fields:
                warn_days = 30
                if field.config and "warn_days" in field.config:
                    warn_days = int(field.config["warn_days"])

                warn_until = today + timedelta(days=warn_days)

                # Load entity to get company_id
                entity_result = await db.execute(
                    select(Entity).where(Entity.id == field.entity_id)
                )
                entity = entity_result.scalar_one_or_none()
                if not entity:
                    continue

                # Find records where this field's date is within warn window
                records_result = await db.execute(
                    select(EntityRecord).where(
                        EntityRecord.entity_id == field.entity_id
                    )
                )
                records = records_result.scalars().all()

                for record in records:
                    raw_val = record.data.get(field.slug)
                    if not raw_val:
                        continue
                    try:
                        expiry = date.fromisoformat(str(raw_val))
                    except ValueError:
                        continue

                    days_left = (expiry - today).days

                    # Notify if: expired already or expiring within warn_days
                    if days_left > warn_days:
                        continue

                    # Deduplicate: notify once per day per record+field
                    cache_key = f"expiry_notified:{record.id}:{field.slug}:{today.isoformat()}"
                    already_notified = await redis.exists(cache_key)
                    if already_notified:
                        continue

                    # Build human-readable record label from first text field
                    label = str(record.id)[:8]
                    for slug, val in record.data.items():
                        if isinstance(val, str) and val:
                            label = val[:50]
                            break

                    if days_left < 0:
                        msg = (
                            f"⛔ Просрочено: «{entity.name}» — {label}\n"
                            f"Поле «{field.name}»: истёк {expiry.strftime('%d.%m.%Y')} "
                            f"({abs(days_left)} дн. назад)"
                        )
                    elif days_left == 0:
                        msg = (
                            f"🔴 Истекает сегодня: «{entity.name}» — {label}\n"
                            f"Поле «{field.name}»: {expiry.strftime('%d.%m.%Y')}"
                        )
                    else:
                        msg = (
                            f"⚠️ Срок годности: «{entity.name}» — {label}\n"
                            f"Поле «{field.name}»: {expiry.strftime('%d.%m.%Y')} "
                            f"(осталось {days_left} дн.)"
                        )

                    try:
                        tg_service = TelegramService(db, entity.company_id)
                        await tg_service.send_notification(
                            redis, "expiry_warning", entity.company_id, msg
                        )
                        await redis.set(cache_key, "1", ex=86400)
                    except Exception as e:
                        logger.warning(f"Failed to send expiry notification: {e}")

        except Exception as e:
            logger.error(f"Error in expiry checker: {e}")
