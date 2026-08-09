import time
from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, Request, status

try:
    from redis.asyncio import Redis
except ImportError:  # pragma: no cover
    Redis = None

from app.config import settings

_client: Redis | None = None
_limits: dict[str, int] = {}
_windows: dict[str, Callable[[], float]] = {}


async def get_redis() -> "Redis | None":
    global _client
    if Redis is None:
        return None
    if _client is None:
        _client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def rate_limit(limit: int = 60, window_seconds: int = 60):
    async def dependency(request: Request):
        key = f"rl:{request.client.host}:{request.url.path}"
        client = await get_redis()
        if client is not None:
            try:
                count = await client.incr(key)
                if count == 1:
                    await client.expire(key, window_seconds)
                if count > limit:
                    raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")
                return
            except HTTPException:
                raise
            except Exception:
                pass
        stamps = _windows.get(key)
        if stamps is None:
            stamps = _windows.setdefault(key, defaultdict(float))
        now = time.monotonic()
        stamps[now] = stamps[now] + 0
        stale = [t for t in stamps if now - t > window_seconds]
        for t in stale:
            del stamps[t]
        if len(stamps) >= limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")
        stamps[now] = stamps.get(now, 0) + 1

    return dependency
