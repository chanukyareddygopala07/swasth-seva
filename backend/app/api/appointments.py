from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.core.deps import DbSession, get_current_user
from app.models.user import Appointment, Department, Doctor, Hospital, Patient, User
from app.models.queue import Queue, Token
from app.schemas.clinical import AppointmentCreate, AppointmentOut, AppointmentUpdate
from app.services.ai_service import no_show_predict
from app.services.notification import create_notification, send_email, send_sms

router = APIRouter(tags=["appointments"])


def _serialize(appointment: Appointment) -> AppointmentOut:
    out = AppointmentOut.model_validate(appointment)
    if appointment.hospital:
        out.hospital_name = appointment.hospital.name
    if appointment.doctor:
        out.doctor_name = appointment.doctor.user.full_name if appointment.doctor.user else None
    if appointment.department:
        out.department_name = appointment.department.name
    return out


@router.get("/appointments", response_model=list[AppointmentOut])
async def list_appointments(
    db: DbSession,
    user=Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    if user.role == "patient":
        stmt = select(Appointment).join(Patient, Patient.user_id == user.id).where(Appointment.patient_id == Patient.id)
    elif user.role == "doctor":
        stmt = select(Appointment).join(Doctor, Doctor.user_id == user.id).where(Appointment.doctor_id == Doctor.id)
    elif user.role in ("admin", "receptionist", "super_admin"):
        stmt = select(Appointment).where(Appointment.hospital_id == user.hospital_id) if user.hospital_id else select(Appointment)
    else:
        stmt = select(Appointment).where(Appointment.hospital_id == user.hospital_id) if user.hospital_id else select(Appointment)
    if status_filter:
        stmt = stmt.where(Appointment.status == status_filter)
    stmt = stmt.order_by(Appointment.scheduled_at.desc()).offset((page - 1) * page_size).limit(page_size)
    appointments = list((await db.execute(stmt)).scalars().all())
    return [_serialize(a) for a in appointments]


@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(payload: AppointmentCreate, db: DbSession, user=Depends(get_current_user)):
    patient = None
    if user.role == "patient":
        stmt = select(Patient).where(Patient.user_id == user.id)
        patient = (await db.execute(stmt)).scalar_one_or_none()
        if not patient:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient profile not found")
    elif payload.patient_id:
        patient = await db.get(Patient, payload.patient_id)
    elif payload.patient_phone:
        stmt = select(Patient).join(User, Patient.user_id == User.id).where(User.phone == payload.patient_phone)
        patient = (await db.execute(stmt)).scalar_one_or_none()
    if not patient:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "patient_id or patient_phone required")
    hospital = await db.get(Hospital, payload.hospital_id)
    if not hospital:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    doctor = None
    if payload.doctor_id:
        doctor = await db.get(Doctor, payload.doctor_id)
        if not doctor:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=payload.doctor_id,
        hospital_id=payload.hospital_id,
        department_id=payload.department_id or (doctor.department_id if doctor else None),
        scheduled_at=payload.scheduled_at,
        reason=payload.reason,
    )
    db.add(appointment)
    await db.flush()
    await create_notification(
        db, user.id, "Appointment booked",
        f"Appointment at {hospital.name} on {payload.scheduled_at.strftime('%d %b %Y %H:%M')}.",
        "appointment",
    )
    await db.commit()
    await db.refresh(appointment)
    result = _serialize(appointment)
    if user.phone:
        send_sms(user.phone, f"Appointment confirmed at {hospital.name} on {payload.scheduled_at.strftime('%d %b, %H:%M')}.")
    return result


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(appointment_id: str, payload: AppointmentUpdate, db: DbSession, user=Depends(get_current_user)):
    appointment = await db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    if user.role == "patient":
        patient = (await db.execute(select(Patient).where(Patient.user_id == user.id))).scalar_one_or_none()
        if not patient or patient.id != appointment.patient_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(appointment, key, value)
    await db.commit()
    await db.refresh(appointment)
    return _serialize(appointment)


@router.post("/appointments/{appointment_id}/cancel")
async def cancel_appointment(appointment_id: str, db: DbSession, user=Depends(get_current_user)):
    appointment = await db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    appointment.status = "cancelled"
    await db.commit()
    return {"success": True, "message": "Appointment cancelled"}


@router.get("/appointments/{appointment_id}/no-show-prediction")
async def appointment_no_show(appointment_id: str, db: DbSession):
    appointment = await db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    result = await no_show_predict(
        patient_id=appointment.patient_id,
        day_of_week=appointment.scheduled_at.weekday(),
        hour=appointment.scheduled_at.hour,
    )
    return result


@router.get("/doctors", response_model=list[dict])
async def list_doctors(
    db: DbSession,
    hospital_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    available_only: bool = Query(False),
):
    stmt = select(Doctor)
    if hospital_id:
        stmt = stmt.where(Doctor.hospital_id == hospital_id)
    if department_id:
        stmt = stmt.where(Doctor.department_id == department_id)
    if available_only:
        stmt = stmt.where(Doctor.is_available.is_(True))
    if search:
        stmt = stmt.join(User, Doctor.user_id == User.id).where(
            or_(User.full_name.ilike(f"%{search}%"), Doctor.specialization.ilike(f"%{search}%"))
        )
    doctors = list((await db.execute(stmt)).scalars().all())
    user_ids = [d.user_id for d in doctors]
    users_map = {}
    if user_ids:
        user_rows = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        users_map = {u.id: u for u in user_rows}
    result = []
    for d in doctors:
        u = users_map.get(d.user_id)
        result.append(
            {
                "id": d.id,
                "user_id": d.user_id,
                "full_name": u.full_name if u else None,
                "email": u.email if u else None,
                "phone": u.phone if u else None,
                "avatar_url": u.avatar_url if u else None,
                "specialization": d.specialization,
                "experience_years": d.experience_years,
                "avg_consultation_minutes": d.avg_consultation_minutes,
                "rating": d.rating,
                "is_available": d.is_available,
                "hospital_id": d.hospital_id,
                "department_id": d.department_id,
                "hospital_name": d.hospital.name if d.hospital else None,
            }
        )
    return result




@router.get("/doctors/me")
async def get_doctor_me(db: DbSession, user=Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctors only")
    from app.services.ai_service import workload_predict

    doctor = (await db.execute(select(Doctor).where(Doctor.user_id == user.id))).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor profile not found")
    return {
        "id": doctor.id,
        "full_name": user.full_name,
        "specialization": doctor.specialization,
        "experience_years": doctor.experience_years,
        "avg_consultation_minutes": doctor.avg_consultation_minutes,
        "rating": doctor.rating,
        "is_available": doctor.is_available,
        "bio": doctor.bio,
        "hospital_id": doctor.hospital_id,
        "hospital_name": doctor.hospital.name if doctor.hospital else None,
        "department_id": doctor.department_id,
        "workload": await workload_predict(db, doctor.id),
    }


@router.get("/doctors/{doctor_id}", response_model=dict)
async def get_doctor(doctor_id: str, db: DbSession):
    doctor = await db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    return {
        "id": doctor.id,
        "user_id": doctor.user_id,
        "full_name": doctor.user.full_name if doctor.user else None,
        "email": doctor.user.email if doctor.user else None,
        "phone": doctor.user.phone if doctor.user else None,
        "avatar_url": doctor.user.avatar_url if doctor.user else None,
        "specialization": doctor.specialization,
        "license_number": doctor.license_number,
        "experience_years": doctor.experience_years,
        "avg_consultation_minutes": doctor.avg_consultation_minutes,
        "rating": doctor.rating,
        "is_available": doctor.is_available,
        "bio": doctor.bio,
        "hospital_id": doctor.hospital_id,
        "department_id": doctor.department_id,
        "hospital_name": doctor.hospital.name if doctor.hospital else None,
    }
