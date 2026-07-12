import json

import httpx

from app.redis_client import get_redis

RATES_URL = "https://open.er-api.com/v6/latest/USD"
CACHE_KEY = "exchange_rates:USD"
CACHE_TTL = 3600  # free API updates ~once/day; 1h keeps rates fresh enough without hammering it


async def get_exchange_rates() -> dict[str, float]:
    """USD-based rates (units of each currency per 1 USD), cached in Redis."""
    redis = await get_redis()
    cached = await redis.get(CACHE_KEY)
    if cached:
        return json.loads(cached)

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(RATES_URL)
            resp.raise_for_status()
            rates = resp.json().get("rates", {})
    except Exception:
        return {}

    await redis.setex(CACHE_KEY, CACHE_TTL, json.dumps(rates))
    return rates
