import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.misc import Notification
from app.models.user import User
from app.ws.manager import manager

logger = logging.getLogger("swasth.notifications")


async def create_notification(
    db: AsyncSession,
    user_id: str,
    title: str,
    body: Optional[str] = None,
    ntype: str = "general",
    channel: str = "in_app",
) -> Notification:
    notification = Notification(user_id=user_id, title=title, body=body, type=ntype, channel=channel)
    db.add(notification)
    await db.flush()
    await manager.broadcast_user(
        user_id,
        "notification",
        {"id": notification.id, "title": title, "body": body, "type": ntype, "channel": channel, "is_read": False},
    )
    return notification


async def notify_token(db: AsyncSession, user_id: str, token_number: int, wait: int, priority: str) -> None:
    await create_notification(
        db,
        user_id,
        f"Token {token_number} issued",
        f"Your estimated wait time is {wait} minutes (priority: {priority}). Track the queue in real time.",
        "token",
    )


async def notify_token_called(db: AsyncSession, user_id: str, token_number: int, doctor_name: Optional[str]) -> None:
    await create_notification(
        db,
        user_id,
        f"Token {token_number} — it's your turn",
        f"Please proceed to the consultation room{(' of Dr. ' + doctor_name) if doctor_name else ''} now.",
        "token",
    )


async def notify_appointment_reminder(db: AsyncSession, user_id: str, when: str, hospital: str) -> None:
    await create_notification(
        db,
        user_id,
        "Appointment reminder",
        f"Your appointment at {hospital} is scheduled for {when}. Be there 15 minutes early.",
        "appointment",
    )


def send_email(to: str, subject: str, html: str) -> None:
    if not settings.SMTP_HOST:
        logger.info("[email-abstraction] to=%s subject=%s", to, subject)
        return
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER or "", settings.SMTP_PASSWORD or "")
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())
    except Exception as exc:
        logger.warning("email send failed: %s", exc)


def send_sms(phone: str, message: str) -> None:
    provider = settings.SMS_PROVIDER
    if provider == "abstraction" or not settings.SMS_API_KEY:
        logger.info("[sms-abstraction] to=%s msg=%s", phone, message)
        return
    try:
        import httpx

        httpx.post(
            f"https://api.{provider}.com/v1/messages",
            json={"to": phone, "text": message, "from": settings.SMS_SENDER_ID},
            headers={"Authorization": f"Bearer {settings.SMS_API_KEY}"},
            timeout=5,
        )
    except Exception as exc:
        logger.warning("sms send failed: %s", exc)


def send_whatsapp(phone: str, message: str) -> None:
    if not settings.WHATSAPP_API_KEY:
        logger.info("[whatsapp-abstraction] to=%s msg=%s", phone, message)
        return
    try:
        import httpx

        httpx.post(
            f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_ID}/messages",
            json={"messaging_product": "whatsapp", "to": phone, "type": "text", "text": {"body": message}},
            headers={"Authorization": f"Bearer {settings.WHATSAPP_API_KEY}"},
            timeout=5,
        )
    except Exception as exc:
        logger.warning("whatsapp send failed: %s", exc)


def send_push(user: User, title: str, body: str) -> None:
    if not settings.FCM_SERVER_KEY:
        logger.info("[push-abstraction] to=%s title=%s", user.id, title)
        return
    try:
        import httpx

        httpx.post(
            "https://fcm.googleapis.com/v1/projects/swasth-seva/messages:send",
            json={"message": {"token": user.id, "notification": {"title": title, "body": body}}},
            headers={"Authorization": f"Bearer {settings.FCM_SERVER_KEY}"},
            timeout=5,
        )
    except Exception as exc:
        logger.warning("push send failed: %s", exc)


def send_emergency_alert(phone: str, lat: Optional[float], lng: Optional[float]) -> None:
    link = f"https://maps.google.com/?q={lat},{lng}" if lat and lng else "location unavailable"
    message = f"EMERGENCY: A patient needs immediate assistance. Location: {link}"
    send_sms(phone, message)
    send_whatsapp(phone, message)
