from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.queue import Queue, Token
from app.models.user import Department, Doctor, Hospital, Patient
from app.services.ai_service import predict_wait_time
from app.ws.manager import manager

PRIORITY_ORDER = {"red": 0, "orange": 1, "yellow": 2, "green": 3}


async def get_or_create_queue(
    db: AsyncSession,
    hospital_id: str,
    department_id: str,
    doctor_id: Optional[str] = None,
) -> Queue:
    today = datetime.now(timezone.utc).date().isoformat()
    stmt = select(Queue).where(
        Queue.hospital_id == hospital_id,
        Queue.department_id == department_id,
        Queue.date == today,
        Queue.is_active.is_(True),
    )
    if doctor_id:
        stmt = stmt.where(Queue.doctor_id == doctor_id)
    result = await db.execute(stmt)
    queue = result.scalar_one_or_none()
    if queue is None:
        queue = Queue(
            hospital_id=hospital_id,
            department_id=department_id,
            doctor_id=doctor_id,
            date=today,
            is_active=True,
            next_token=1,
        )
        db.add(queue)
        await db.flush()
    return queue


async def next_token_number(db: AsyncSession, queue: Queue) -> int:
    queue.next_token += 1
    return queue.next_token - 1


async def compute_priority(triage_score: Optional[float]) -> str:
    if triage_score is None:
        return "green"
    if triage_score >= 0.8:
        return "red"
    if triage_score >= 0.6:
        return "orange"
    if triage_score >= 0.4:
        return "yellow"
    return "green"


def _active_statuses() -> list[str]:
    return ["waiting", "called", "emergency"]


async def count_by_priority(db: AsyncSession, queue_id: str, priority: str) -> int:
    stmt = (
        select(func.count(Token.id))
        .where(Token.queue_id == queue_id, Token.status.in_(_active_statuses()), Token.priority == priority)
    )
    result = await db.execute(stmt)
    return result.scalar_one() or 0


async def refresh_queue_state(db: AsyncSession, queue: Queue) -> None:
    for t in await _load_tokens(db, queue.id):
        await manager.broadcast_token_update(queue.id, t, "queue_update")


async def _load_tokens(db: AsyncSession, queue_id: str) -> list[Token]:
    stmt = select(Token).where(Token.queue_id == queue_id).order_by(Token.created_at.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


def serialize_token(token: Token) -> dict:
    return {
        "id": token.id,
        "token_number": token.token_number,
        "priority": token.priority,
        "status": token.status,
        "symptoms": token.symptoms,
        "predicted_wait_minutes": token.predicted_wait_minutes,
        "created_at": token.created_at.isoformat(),
    }


async def call_next(db: AsyncSession, queue: Queue) -> Token | None:
    tokens = await _load_tokens(db, queue.id)
    waiting = [t for t in tokens if t.status == "waiting"]
    waiting.sort(key=lambda t: (PRIORITY_ORDER[t.priority], t.created_at.timestamp() if t.created_at else 0))
    if not waiting:
        return None
    token = waiting[0]
    token.status = "called"
    token.called_at = datetime.now(timezone.utc)
    await db.flush()
    await manager.broadcast_token_update(queue.id, token, "token_called")
    await manager.broadcast_queue(queue.id, "current_token", {"token_number": token.token_number, "priority": token.priority})
    return token


async def skip_token(db: AsyncSession, queue: Queue, token: Token) -> Token:
    token.status = "skipped"
    await db.flush()
    await manager.broadcast_token_update(queue.id, token, "token_skipped")
    return token


async def complete_token(db: AsyncSession, queue: Queue, token: Token) -> Token:
    token.status = "completed"
    token.completed_at = datetime.now(timezone.utc)
    if token.called_at:
        token.actual_wait_minutes = int((token.completed_at - token.called_at).total_seconds() // 60)
    await db.flush()
    await manager.broadcast_token_update(queue.id, token, "token_completed")
    await manager.broadcast_user(token.patient_id or "", "token_completed", serialize_token(token))
    return token


async def cancel_token(db: AsyncSession, queue: Queue, token: Token) -> Token:
    token.status = "cancelled"
    await db.flush()
    await manager.broadcast_token_update(queue.id, token, "token_cancelled")
    await manager.broadcast_user(token.patient_id or "", "token_cancelled", serialize_token(token))
    return token


async def emergency_override(db: AsyncSession, queue: Queue) -> Token | None:
    tokens = await _load_tokens(db, queue.id)
    urgent = [t for t in tokens if t.status == "waiting" and t.priority in ("red", "orange")]
    if not urgent:
        return None
    token = min(urgent, key=lambda t: (PRIORITY_ORDER[t.priority], t.created_at.timestamp() if t.created_at else 0))
    token.status = "called"
    token.called_at = datetime.now(timezone.utc)
    await db.flush()
    await manager.broadcast_token_update(queue.id, token, "emergency_override")
    await manager.broadcast_queue(queue.id, "current_token", {"token_number": token.token_number, "priority": token.priority})
    return token


async def queue_summary(db: AsyncSession, queue: Queue) -> dict:
    tokens = await _load_tokens(db, queue.id)
    waiting = [t for t in tokens if t.status in ("waiting", "called", "emergency")]
    completed = [t for t in tokens if t.status == "completed"]
    avg_wait = None
    waits = [t.actual_wait_minutes for t in completed if t.actual_wait_minutes is not None]
    if waits:
        avg_wait = sum(waits) / len(waits)
    current = next((t for t in tokens if t.status == "called"), None)
    return {
        "id": queue.id,
        "is_active": queue.is_active,
        "next_token": queue.next_token,
        "current_token": current.token_number if current else None,
        "current_token_priority": current.priority if current else None,
        "waiting_count": len(waiting),
        "completed_count": len(completed),
        "avg_wait_minutes": round(avg_wait, 1) if avg_wait is not None else None,
        "tokens": [serialize_token(t) for t in tokens],
    }


async def estimate_wait_for_new_token(
    db: AsyncSession, queue: Queue, priority: str, hospital_id: str, department_id: str, triage_score: Optional[float]
) -> int:
    ahead = 0
    for p in PRIORITY_ORDER:
        if p == priority:
            break
        ahead += await count_by_priority(db, queue.id, p)
    same_priority = await count_by_priority(db, queue.id, priority)
    ahead += same_priority
    queue_size = ahead
    result = predict_wait_time(
        queue_size=queue_size,
        avg_consultation_minutes=await _avg_consultation(db, department_id, queue.doctor_id),
        emergency_count=await count_by_priority(db, queue.id, "red"),
        hour=datetime.now(timezone.utc).hour,
        day_of_week=datetime.now(timezone.utc).weekday(),
        doctors_count=1,
    )
    return result["predicted_wait_minutes"]


async def _avg_consultation(db: AsyncSession, department_id: str, doctor_id: Optional[str]) -> int:
    if doctor_id:
        doctor = await db.get(Doctor, doctor_id)
        if doctor:
            return doctor.avg_consultation_minutes
    dept = await db.get(Department, department_id)
    return dept.avg_consultation_minutes if dept else 10


def enrich_token(token: Token) -> dict:
    data = serialize_token(token)
    data.update(
        {
            "id": token.id,
            "queue_id": token.queue_id,
            "patient_id": token.patient_id,
            "token_number": token.token_number,
            "priority": token.priority,
            "triage_score": token.triage_score,
            "status": token.status,
            "is_walk_in": token.is_walk_in,
            "predicted_wait_minutes": token.predicted_wait_minutes,
            "actual_wait_minutes": token.actual_wait_minutes,
        }
    )
    return data


async def add_token(
    db: AsyncSession,
    queue: Queue,
    patient_id: Optional[str],
    symptoms: list[str],
    triage_score: Optional[float],
    is_walk_in: bool,
    appointment_id: Optional[str] = None,
) -> Token:
    priority = await compute_priority(triage_score)
    number = await next_token_number(db, queue)
    predicted = await estimate_wait_for_new_token(
        db, queue, priority, queue.hospital_id, queue.department_id, triage_score
    )
    token = Token(
        queue_id=queue.id,
        patient_id=patient_id,
        appointment_id=appointment_id,
        token_number=number,
        priority=priority,
        triage_score=triage_score,
        status="waiting",
        is_walk_in=is_walk_in,
        symptoms=symptoms,
        predicted_wait_minutes=predicted,
    )
    db.add(token)
    await db.flush()
    await manager.broadcast_token_update(queue.id, token, "token_created")
    await manager.broadcast_queue(queue.id, "new_token", {"token_number": number, "priority": priority})
    return token
