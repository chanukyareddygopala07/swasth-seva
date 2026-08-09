from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.models.misc import Notification
from app.schemas.misc import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(db: DbSession, user=Depends(get_current_user), unread_only: bool = False):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc()).limit(100)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/unread-count")
async def unread_count(db: DbSession, user=Depends(get_current_user)):
    stmt = select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))
    count = len(list((await db.execute(stmt)).scalars().all()))
    return {"count": count}


@router.post("/read-all")
async def mark_all_read(db: DbSession, user=Depends(get_current_user)):
    stmt = select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))
    notifications = list((await db.execute(stmt)).scalars().all())
    for n in notifications:
        n.is_read = True
    await db.commit()
    return {"success": True, "count": len(notifications)}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, db: DbSession, user=Depends(get_current_user)):
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    notification.is_read = True
    await db.commit()
    return {"success": True}
