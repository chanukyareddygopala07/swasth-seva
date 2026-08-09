import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.models.misc import LabBooking, MedicationReminder, Notification
from app.models.queue import Feedback, MedicalRecord, Prescription
from app.models.user import Appointment, Doctor, Hospital, Patient, User
from app.schemas.clinical import (
    LabBookingCreate,
    MedicationReminderCreate,
    MedicalRecordCreate,
    MedicalRecordOut,
)
from app.schemas.user import FamilyMember, PatientOut, PatientUpdate, UserOut, UserUpdate

router = APIRouter(tags=["users"])


async def _get_patient(db, user: User) -> Patient:
    patient = (await db.execute(select(Patient).where(Patient.user_id == user.id))).scalar_one_or_none()
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient profile not found")
    return patient


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        role=user.role,
        is_verified=user.is_verified,
        language=user.language,
        theme=user.theme,
        avatar_url=user.avatar_url,
        hospital_id=user.hospital_id,
        created_at=user.created_at,
    )


@router.patch("/users/me", response_model=UserOut)
async def update_profile(payload: UserUpdate, db: DbSession, user=Depends(get_current_user)):
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.get("/patients/me", response_model=PatientOut)
async def get_my_patient(db: DbSession, user=Depends(get_current_user)):
    return await _get_patient(db, user)


@router.patch("/patients/me", response_model=PatientOut)
async def update_my_patient(payload: PatientUpdate, db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, key, value)
    await db.commit()
    await db.refresh(patient)
    return patient


@router.post("/patients/me/family", response_model=PatientOut)
async def add_family_member(payload: FamilyMember, db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    members = list(patient.family_members or [])
    member = payload.model_dump(mode="json")
    member["id"] = f"fm-{len(members) + 1}"
    members.append(member)
    patient.family_members = members
    await db.commit()
    await db.refresh(patient)
    return patient


@router.delete("/patients/me/family/{member_id}", response_model=PatientOut)
async def remove_family_member(member_id: str, db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    patient.family_members = [m for m in (patient.family_members or []) if m.get("id") != member_id]
    await db.commit()
    await db.refresh(patient)
    return patient


@router.post("/patients/me/qr")
async def generate_qr(db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    import io
    import base64

    data = f"swasth-seva://patient/{patient.id}?name={user.full_name}"
    buf = io.BytesIO()
    qrcode.make(data).save(buf, format="PNG")
    patient.qr_code = base64.b64encode(buf.getvalue()).decode()
    await db.commit()
    return {"qr_code": patient.qr_code}


@router.get("/patients/me/records", response_model=list[MedicalRecordOut])
async def my_records(db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    stmt = select(MedicalRecord).where(MedicalRecord.patient_id == patient.id).order_by(MedicalRecord.created_at.desc())
    records = list((await db.execute(stmt)).scalars().all())
    return await _serialize_records(db, records)


@router.get("/patients/{patient_id}/records", response_model=list[MedicalRecordOut])
async def patient_records(patient_id: str, db: DbSession, user=Depends(get_current_user)):
    if user.role not in ("doctor", "admin", "receptionist", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    stmt = select(MedicalRecord).where(MedicalRecord.patient_id == patient_id).order_by(MedicalRecord.created_at.desc())
    records = list((await db.execute(stmt)).scalars().all())
    return await _serialize_records(db, records)


@router.post("/records", response_model=MedicalRecordOut, status_code=status.HTTP_201_CREATED)
async def create_record(payload: MedicalRecordCreate, db: DbSession, user=Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctors only")
    doctor = (await db.execute(select(Doctor).where(Doctor.user_id == user.id))).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor profile not found")
    record = MedicalRecord(
        patient_id=payload.patient_id,
        doctor_id=doctor.id,
        hospital_id=doctor.hospital_id,
        diagnosis=payload.diagnosis,
        symptoms=payload.symptoms,
        notes=payload.notes,
        vitals=payload.vitals,
    )
    db.add(record)
    await db.flush()
    for item in payload.prescriptions:
        reminder = item.get("reminder_time")
        db.add(
            Prescription(
                record_id=record.id,
                medicine=item.get("medicine", ""),
                dosage=item.get("dosage"),
                frequency=item.get("frequency"),
                duration=item.get("duration"),
                instructions=item.get("instructions"),
                reminder_time=reminder,
            )
        )
    await db.commit()
    await db.refresh(record)
    return MedicalRecordOut.model_validate(record)


@router.post("/lab-bookings", status_code=status.HTTP_201_CREATED)
async def book_lab(payload: LabBookingCreate, db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    booking = LabBooking(
        patient_id=patient.id,
        lab_id=payload.lab_id,
        test=payload.test,
        scheduled_at=payload.scheduled_at,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return {"success": True, "id": booking.id, "message": "Lab booked"}


@router.get("/lab-bookings")
async def my_lab_bookings(db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    stmt = select(LabBooking).where(LabBooking.patient_id == patient.id).order_by(LabBooking.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("/medication-reminders", status_code=status.HTTP_201_CREATED)
async def create_reminder(payload: MedicationReminderCreate, db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    reminder = MedicationReminder(
        patient_id=patient.id,
        medicine=payload.medicine,
        dosage=payload.dosage,
        reminder_time=payload.reminder_time,
        active=payload.active,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return {"success": True, "id": reminder.id}


@router.get("/medication-reminders")
async def my_reminders(db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    stmt = select(MedicationReminder).where(MedicationReminder.patient_id == patient.id, MedicationReminder.active.is_(True)).order_by(MedicationReminder.reminder_time)
    return list((await db.execute(stmt)).scalars().all())


@router.delete("/medication-reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    reminder = await db.get(MedicationReminder, reminder_id)
    if not reminder or reminder.patient_id != patient.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reminder not found")
    reminder.active = False
    await db.commit()
    return {"success": True}


@router.get("/pharmacies")
async def list_pharmacies(db: DbSession, city: str | None = None):
    from app.models.misc import Pharmacy

    stmt = select(Pharmacy)
    if city:
        stmt = stmt.where(Pharmacy.city == city)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/labs")
async def list_labs(db: DbSession, city: str | None = None):
    from app.models.misc import Lab

    stmt = select(Lab)
    if city:
        stmt = stmt.where(Lab.city == city)
    return list((await db.execute(stmt)).scalars().all())

async def _serialize_records(db, records: list[MedicalRecord]) -> list[MedicalRecordOut]:
    result = []
    for r in records:
        doctor = await db.get(Doctor, r.doctor_id) if r.doctor_id else None
        hospital = await db.get(Hospital, r.hospital_id)
        doctor_name = doctor.user.full_name if doctor else None
        pres = (
            await db.execute(select(Prescription).where(Prescription.record_id == r.id))
        ).scalars().all()
        result.append(
            MedicalRecordOut(
                id=r.id,
                patient_id=r.patient_id,
                doctor_id=r.doctor_id,
                hospital_id=r.hospital_id,
                diagnosis=r.diagnosis,
                symptoms=r.symptoms,
                notes=r.notes,
                vitals=r.vitals,
                created_at=r.created_at,
                doctor_name=doctor_name,
                hospital_name=hospital.name if hospital else None,
                prescriptions=[
                    {"medicine": p.medicine, "dosage": p.dosage, "frequency": p.frequency, "duration": p.duration, "instructions": p.instructions}
                    for p in pres
                ],
            )
        )
    return result

