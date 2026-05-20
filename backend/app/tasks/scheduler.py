from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="UTC")


def setup_scheduler():
    from app.tasks.expiration_checker import check_and_block_expired_users
    from app.tasks.expiry_product_checker import check_expiring_products

    scheduler.add_job(
        check_and_block_expired_users,
        trigger=CronTrigger(minute="*/5"),
        id="expiration_checker",
        replace_existing=True,
        misfire_grace_time=60,
    )

    scheduler.add_job(
        check_expiring_products,
        trigger=CronTrigger(hour=9, minute=0),  # Every day at 09:00 UTC
        id="expiry_product_checker",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    return scheduler
