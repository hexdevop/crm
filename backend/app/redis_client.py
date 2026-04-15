from redis.asyncio import Redis, ConnectionPool
from app.config import settings

_pool: ConnectionPool | None = None
_redis: Redis | None = None


async def get_redis() -> Redis:
    global _pool, _redis
    if _redis is None:
        _pool = ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
        _redis = Redis(connection_pool=_pool)
    return _redis


async def close_redis() -> None:
    global _pool, _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
    if _pool is not None:
        await _pool.aclose()
        _pool = None
