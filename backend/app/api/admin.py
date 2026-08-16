from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.deps import DbSession, get_current_user
from app.core.security import hash_password
from app.models.user import Department, Doctor, Hospital, Patient, User
from app.schemas.user import DoctorAvailability, DoctorOut, DoctorUpdate
router = APIRouter(tags=["admin"])


async def _require_admin_or_above(db, user: User) -> None:
    if user.role not in ("admin", "super_admin", "doctor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")


@router.get("/admin/overview")
async def admin_overview(db: DbSession, user=Depends(get_current_user)):
    await _require_admin_or_above(db, user)
    hospital_id = user.hospital_id if user.role == "admin" else None
    today = datetime.now(timezone.utc).date().isoformat()

    from app.models.misc import AnalyticsRecord
    from app.models.queue import Emergency, Queue, Token

    if hospital_id:
        occupancy = (
            await db.execute(
                select(func.coalesce(func.max(AnalyticsRecord.occupancy_pct), 0)).where(
                    AnalyticsRecord.hospital_id == hospital_id, AnalyticsRecord.date == today
                )
            )
        ).scalar_one()
        doctors_online = (
            await db.execute(
                select(func.count(Doctor.id)).where(Doctor.hospital_id == hospital_id, Doctor.is_available.is_(True))
            )
        ).scalar_one()
        waiting = 0
        q_ids = [
            r
            for r in (
                await db.execute(select(Queue.id).where(Queue.hospital_id == hospital_id, Queue.date == today, Queue.is_active.is_(True)))
            ).scalars()
        ]
        if q_ids:
            waiting = (
                await db.execute(
                    select(func.count(Token.id)).where(Token.queue_id.in_(q_ids), Token.status.in_(["waiting", "called"]))
                )
            ).scalar_one() or 0
        emergencies = (
            await db.execute(
                select(func.count(Emergency.id)).where(Emergency.hospital_id == hospital_id, Emergency.status == "open")
            )
        ).scalar_one()
        departments = (
            await db.execute(
                select(func.count())
                .select_from(Department)
                .where(
                    Department.hospital_id == hospital_id,
                    Department.is_active.is_(True),
                )
            )
        ).scalar_one()
    else:
        occupancy = (await db.execute(select(func.coalesce(func.avg(Hospital.occupancy_pct), 0)))).scalar_one()
        doctors_online = (await db.execute(select(func.count(Doctor.id)).where(Doctor.is_available.is_(True)))).scalar_one()
        q_ids = [r for r in (await db.execute(select(Queue.id).where(Queue.date == today, Queue.is_active.is_(True)))).scalars()]
        waiting = 0
        if q_ids:
            waiting = (
                await db.execute(
                    select(func.count(Token.id)).where(Token.queue_id.in_(q_ids), Token.status.in_(["waiting", "called"]))
                )
            ).scalar_one() or 0
        emergencies = (await db.execute(select(func.count(Emergency.id)).where(Emergency.status == "open"))).scalar_one()
        departments = (await db.execute(select(func.count(Department.id)).where(Department.is_active.is_(True)))).scalar_one()

    return {
        "hospital_id": hospital_id,
        "occupancy_pct": round(float(occupancy or 0), 1),
        "doctors_online": doctors_online,
        "patients_waiting": waiting,
        "emergencies_open": emergencies,
        "departments": departments,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.patch("/doctors/me/availability")
async def toggle_availability(payload: DoctorAvailability, db: DbSession, user=Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctors only")
    doctor = (await db.execute(select(Doctor).where(Doctor.user_id == user.id))).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor profile not found")
    doctor.is_available = payload.is_available
    if payload.avg_consultation_minutes:
        doctor.avg_consultation_minutes = payload.avg_consultation_minutes
    await db.commit()
    await db.refresh(doctor)
    return DoctorOut.model_validate(doctor)


@router.patch("/doctors/me")
async def update_doctor_me(payload: DoctorUpdate, db: DbSession, user=Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctors only")
    doctor = (await db.execute(select(Doctor).where(Doctor.user_id == user.id))).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor profile not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(doctor, key, value)
    await db.commit()
    await db.refresh(doctor)
    return DoctorOut.model_validate(doctor)


