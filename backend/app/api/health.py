from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import func, select

from app.config import settings
from app.core.deps import DbSession
from app.models.misc import AuditLog

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: DbSession):
    db_ok = True
    try:
        await db.execute(select(func.count(AuditLog.id)).limit(1))
    except Exception:
        db_ok = False
    redis_ok = True
    try:
        from redis import Redis

        client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        client.ping()
    except Exception:
        redis_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "ok" if db_ok else "down",
        "redis": "ok" if redis_ok else "down",
        "version": "1.0.0",
        "time": datetime.now(timezone.utc).isoformat(),
    }
