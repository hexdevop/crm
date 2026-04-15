import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config import settings
from app.database import engine
from app.redis_client import close_redis, get_redis
from app.tasks.scheduler import setup_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


async def ensure_superadmin():
    """Создает суперпользователя, если он отсутствует в базе данных"""
    from app.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.user import User
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        # Ищем суперпользователя по email из конфига
        result = await db.execute(
            select(User).where(User.email == settings.SUPERADMIN_EMAIL.lower())
        )
        admin = result.scalar_one_or_none()

        if not admin:
            logger.info(f"Creating superadmin: {settings.SUPERADMIN_EMAIL}")
            admin = User(
                email=settings.SUPERADMIN_EMAIL.lower(),
                hashed_password=hash_password(settings.SUPERADMIN_PASSWORD),
                first_name="Super",
                last_name="Admin",
                is_superadmin=True,
                is_active=True,
                company_id=None,
            )
            db.add(admin)
            await db.commit()
            logger.info("Superadmin created successfully")
        elif not admin.is_superadmin:
            admin.is_superadmin = True
            await db.commit()
            logger.info("Updated existing user to superadmin")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting CRM backend...")

    # Verify DB connection
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("Database connection OK")

    # Ensure superadmin exists
    await ensure_superadmin()

    # Verify Redis
    redis = await get_redis()
    await redis.ping()
    logger.info("Redis connection OK")

    # Start scheduler
    scheduler = setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    await close_redis()
    await engine.dispose()
    logger.info("CRM backend stopped")


app = FastAPI(
    title="Universal CRM API",
    description="Multi-tenant CRM system with RBAC, Entity Constructor, and Telegram notifications",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler — never leak stack traces to client
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_ERROR", "message": "Internal server error"}},
    )


# Include all routes
app.include_router(api_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
