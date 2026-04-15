from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="UTC")


def setup_scheduler():
    from app.tasks.expiration_checker import check_and_block_expired_users

    scheduler.add_job(
        check_and_block_expired_users,
        trigger=CronTrigger(minute="*/5"),  # Every 5 minutes
        id="expiration_checker",
        replace_existing=True,
        misfire_grace_time=60,
    )

    return scheduler
