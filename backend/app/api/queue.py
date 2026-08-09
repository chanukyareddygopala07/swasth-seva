from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.models.queue import Emergency, Queue, Token
from app.models.user import Department, Doctor, Hospital, Patient, User
from app.schemas.clinical import TokenCreate, TokenOut, TransferRequest
from app.schemas.misc import QueueOut
from app.services import queue_engine
from app.services.ai_service import triage_result
from app.services.notification import create_notification, notify_token

router = APIRouter(tags=["queue"])

ACTIVE = ("waiting", "called")


def _token_out(token: Token, queue: Queue | None = None) -> TokenOut:
    out = TokenOut(
        id=token.id,
        queue_id=token.queue_id,
        token_number=token.token_number,
        priority=token.priority,
        triage_score=token.triage_score,
        status=token.status,
        symptoms=token.symptoms,
        predicted_wait_minutes=token.predicted_wait_minutes,
        actual_wait_minutes=token.actual_wait_minutes,
        created_at=token.created_at,
        current_token=token.token_number,
    )
    return out


async def _full_token_out(db, token: Token) -> TokenOut:
    queue = await db.get(Queue, token.queue_id)
    hospital = await db.get(Hospital, queue.hospital_id) if queue else None
    dept = await db.get(Department, queue.department_id) if queue else None
    doctor = await db.get(Doctor, queue.doctor_id) if queue and queue.doctor_id else None
    patients_ahead = 0
    current = None
    if queue:
        tokens = list(
            (
                await db.execute(select(Token).where(Token.queue_id == queue.id, Token.status.in_(ACTIVE)).order_by(Token.created_at))
            )
            .scalars()
            .all()
        )
        priority_order = queue_engine.PRIORITY_ORDER
        ordered = sorted(tokens, key=lambda t: (priority_order[t.priority], t.created_at.timestamp() if t.created_at else 0))
        for i, t in enumerate(ordered):
            if t.id == token.id:
                patients_ahead = i
                break
        current = next((t for t in tokens if t.status == "called"), None)
    out = _token_out(token)
    out.hospital_id = queue.hospital_id if queue else None
    out.hospital_name = hospital.name if hospital else None
    out.department_name = dept.name if dept else None
    out.doctor_name = doctor.user.full_name if doctor else None
    out.patients_ahead = patients_ahead
    out.current_token = current.token_number if current else (queue.next_token if queue else None)
    return out


@router.post("/tokens", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def create_token(payload: TokenCreate, db: DbSession, user=Depends(get_current_user)):
    hospital = await db.get(Hospital, payload.hospital_id)
    if not hospital:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    patient = None
    if user.role == "patient":
        patient = (
            await db.execute(select(Patient).where(Patient.user_id == user.id))
        ).scalar_one_or_none()
    department_id = payload.department_id
    if not department_id:
        if payload.doctor_id:
            doctor = await db.get(Doctor, payload.doctor_id)
            department_id = doctor.department_id if doctor else None
        if not department_id:
            depts = list(
                (await db.execute(select(Department).where(Department.hospital_id == payload.hospital_id, Department.is_active.is_(True)))).scalars()
            )
            if depts:
                department_id = depts[0].id
    if not department_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "department_id required")

    triage = triage_result(payload.symptoms)
    queue = await queue_engine.get_or_create_queue(
        db, payload.hospital_id, department_id, payload.doctor_id
    )
    token = await queue_engine.add_token(
        db,
        queue,
        patient.id if patient else None,
        payload.symptoms,
        triage["score"],
        payload.is_walk_in,
        payload.appointment_id,
    )
    if patient:
        await notify_token(db, user.id, token.token_number, token.predicted_wait_minutes or 0, token.priority)
    await db.commit()
    out = await _full_token_out(db, token)
    out.triage_reason = triage["recommendation"]
    out.patients_ahead = out.patients_ahead or 0
    return out


@router.get("/tokens/{token_id}", response_model=TokenOut)
async def get_token(token_id: str, db: DbSession):
    token = await db.get(Token, token_id)
    if not token:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    return await _full_token_out(db, token)


@router.get("/tokens/mine/latest", response_model=TokenOut)
async def my_latest_token(db: DbSession, user=Depends(get_current_user)):
    if user.role != "patient":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Patients only")
    patient = (await db.execute(select(Patient).where(Patient.user_id == user.id))).scalar_one_or_none()
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient profile not found")
    stmt = (
        select(Token)
        .where(Token.patient_id == patient.id)
        .order_by(Token.created_at.desc())
        .limit(1)
    )
    token = (await db.execute(stmt)).scalar_one_or_none()
    if not token:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No tokens yet")
    return await _full_token_out(db, token)


@router.get("/queues", response_model=list[QueueOut])
async def list_queues(
    db: DbSession,
    hospital_id: str = Query(...),
    department_id: str | None = Query(None),
    active_only: bool = Query(True),
):
    from app.models.queue import Queue as Q

    stmt = select(Q).where(Q.hospital_id == hospital_id)
    if department_id:
        stmt = stmt.where(Q.department_id == department_id)
    if active_only:
        stmt = stmt.where(Q.is_active.is_(True))
    stmt = stmt.order_by(Q.created_at.desc())
    queues = list((await db.execute(stmt)).scalars().all())
    result = []
    for q in queues:
        summary = await queue_engine.queue_summary(db, q)
        dept = await db.get(Department, q.department_id)
        doctor = await db.get(Doctor, q.doctor_id) if q.doctor_id else None
        hospital = await db.get(Hospital, q.hospital_id)
        result.append(
            QueueOut(
                **summary,
                hospital_id=q.hospital_id,
                department_id=q.department_id,
                doctor_id=q.doctor_id,
                date=q.date,
                hospital_name=hospital.name if hospital else None,
                department_name=dept.name if dept else None,
                doctor_name=doctor.user.full_name if doctor else None,
            )
        )
    return result


@router.get("/queues/{queue_id}", response_model=QueueOut)
async def get_queue(queue_id: str, db: DbSession):
    queue = await db.get(Queue, queue_id)
    if not queue:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Queue not found")
    summary = await queue_engine.queue_summary(db, queue)
    dept = await db.get(Department, queue.department_id)
    hospital = await db.get(Hospital, queue.hospital_id)
    doctor = await db.get(Doctor, queue.doctor_id) if queue.doctor_id else None
    return QueueOut(
        **summary,
        hospital_id=queue.hospital_id,
        department_id=queue.department_id,
        doctor_id=queue.doctor_id,
        date=queue.date,
        hospital_name=hospital.name if hospital else None,
        department_name=dept.name if dept else None,
        doctor_name=doctor.user.full_name if doctor else None,
    )


async def _require_staff(db, user, queue: Queue) -> None:
    if user.role == "super_admin":
        return
    if user.role in ("admin", "receptionist") and user.hospital_id == queue.hospital_id:
        return
    if user.role == "doctor":
        doctor = (await db.execute(select(Doctor).where(Doctor.user_id == user.id))).scalar_one_or_none()
        if doctor and doctor.id == queue.doctor_id:
            return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")


async def _get_queue_for_token(db, token_id: str) -> tuple[Queue, Token]:
    token = await db.get(Token, token_id)
    if not token:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    queue = await db.get(Queue, token.queue_id)
    if not queue:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Queue not found")
    return queue, token


@router.post("/queues/{queue_id}/call-next")
async def call_next(queue_id: str, db: DbSession, user=Depends(get_current_user)):
    queue = await db.get(Queue, queue_id)
    if not queue:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Queue not found")
    await _require_staff(db, user, queue)
    token = await queue_engine.call_next(db, queue)
    await db.commit()
    if token:
        if token.patient_id:
            patient_user = (
                await db.execute(select(User).join(Patient, Patient.user_id == User.id).where(Patient.id == token.patient_id))
            ).scalar_one_or_none()
            if patient_user:
                from app.services.notification import notify_token_called

                await notify_token_called(db, patient_user.id, token.token_number, queue.doctor_id or None)
        await db.commit()
    return {"success": True, "token": await _full_token_out(db, token) if token else None}


@router.post("/tokens/{token_id}/skip")
async def skip_token(token_id: str, db: DbSession, user=Depends(get_current_user)):
    queue, token = await _get_queue_for_token(db, token_id)
    await _require_staff(db, user, queue)
    token = await queue_engine.skip_token(db, queue, token)
    await db.commit()
    return {"success": True, "token": await _full_token_out(db, token)}


@router.post("/tokens/{token_id}/complete")
async def complete_token(token_id: str, db: DbSession, user=Depends(get_current_user)):
    queue, token = await _get_queue_for_token(db, token_id)
    await _require_staff(db, user, queue)
    token = await queue_engine.complete_token(db, queue, token)
    await db.commit()
    return {"success": True, "token": await _full_token_out(db, token)}


@router.post("/tokens/{token_id}/cancel")
async def cancel_token(token_id: str, db: DbSession, user=Depends(get_current_user)):
    queue, token = await _get_queue_for_token(db, token_id)
    if user.role in ("patient",):
        patient = (await db.execute(select(Patient).where(Patient.user_id == user.id))).scalar_one_or_none()
        if not patient or patient.id != token.patient_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    else:
        await _require_staff(db, user, queue)
    token = await queue_engine.cancel_token(db, queue, token)
    await db.commit()
    return {"success": True, "token": await _full_token_out(db, token)}


@router.post("/queues/{queue_id}/emergency-override")
async def emergency_override(queue_id: str, db: DbSession, user=Depends(get_current_user)):
    queue = await db.get(Queue, queue_id)
    if not queue:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Queue not found")
    await _require_staff(db, user, queue)
    token = await queue_engine.emergency_override(db, queue)
    await db.commit()
    return {"success": True, "token": await _full_token_out(db, token) if token else None}


@router.post("/queues/{queue_id}/close")
async def close_queue(queue_id: str, db: DbSession, user=Depends(get_current_user)):
    queue = await db.get(Queue, queue_id)
    if not queue:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Queue not found")
    await _require_staff(db, user, queue)
    queue.is_active = False
    await db.commit()
    return {"success": True, "message": "Queue closed for the day"}


@router.post("/tokens/{token_id}/transfer")
async def transfer_department(token_id: str, payload: TransferRequest, db: DbSession, user=Depends(get_current_user)):
    queue, token = await _get_queue_for_token(db, token_id)
    await _require_staff(db, user, queue)
    target = await db.get(Department, payload.department_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Target department not found")
    new_queue = await queue_engine.get_or_create_queue(db, queue.hospital_id, payload.department_id)
    await queue_engine.cancel_token(db, queue, token)
    token.queue_id = new_queue.id
    token.status = "waiting"
    token.token_number = await queue_engine.next_token_number(db, new_queue)
    token.created_at = datetime.now(timezone.utc)
    token.predicted_wait_minutes = await queue_engine.estimate_wait_for_new_token(
        db, new_queue, token.priority, new_queue.hospital_id, new_queue.department_id, token.triage_score
    )
    await db.flush()
    from app.ws.manager import manager

    await manager.broadcast_token_update(new_queue.id, token, "token_transferred")
    await db.commit()
    return {"success": True, "token": await _full_token_out(db, token)}
