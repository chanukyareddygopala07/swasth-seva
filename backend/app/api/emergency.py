from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.models.queue import Emergency, Queue, Token
from app.models.user import Department, Hospital, Patient
from app.schemas.clinical import EmergencyCreate, EmergencyOut
from app.services import queue_engine
from app.services.ai_service import triage_result
from app.services.notification import send_emergency_alert

router = APIRouter(prefix="/emergency", tags=["emergency"])


def _serialize(emergency: Emergency, hospital_name: str | None = None) -> EmergencyOut:
    out = EmergencyOut.model_validate(emergency)
    out.hospital_name = hospital_name
    return out


@router.post("", response_model=EmergencyOut, status_code=status.HTTP_201_CREATED)
async def create_emergency(payload: EmergencyCreate, db: DbSession, user=Depends(get_current_user)):
    patient = None
    if user.role == "patient":
        patient = (await db.execute(select(Patient).where(Patient.user_id == user.id))).scalar_one_or_none()
    triage = triage_result(payload.symptoms)
    emergency = Emergency(
        patient_id=patient.id if patient else None,
        hospital_id=payload.hospital_id,
        triage_level=triage["level"],
        symptoms=payload.symptoms,
        description=payload.description,
        location=payload.location,
        lat=payload.lat,
        lng=payload.lng,
        status="open",
    )
    db.add(emergency)
    await db.flush()
    if payload.hospital_id and triage["level"] in ("red", "orange"):
        queue = await queue_engine.get_or_create_queue(
            db, payload.hospital_id, _first_department(db, payload.hospital_id)
        )
        token = await queue_engine.add_token(
            db, queue, patient.id if patient else None, payload.symptoms, triage["score"], False
        )
        emergency.token_id = token.id
        token.status = "emergency"
        await db.flush()
    await db.commit()
    await db.refresh(emergency)
    hospital = await db.get(Hospital, emergency.hospital_id) if emergency.hospital_id else None
    if user.phone:
        send_emergency_alert(user.phone, payload.lat, payload.lng)
    return _serialize(emergency, hospital.name if hospital else None)


async def _first_department(db, hospital_id: str) -> str:
    dept = (
        await db.execute(
            select(Department).where(Department.hospital_id == hospital_id, Department.is_active.is_(True))
        )
    ).scalars().first()
    return dept.id if dept else ""


@router.get("", response_model=list[EmergencyOut])
async def list_emergencies(db: DbSession, user=Depends(get_current_user)):
    if user.role == "patient":
        patient = (await db.execute(select(Patient).where(Patient.user_id == user.id))).scalar_one_or_none()
        if not patient:
            return []
        stmt = select(Emergency).where(Emergency.patient_id == patient.id).order_by(Emergency.created_at.desc())
    elif user.role in ("admin", "receptionist"):
        stmt = (
            select(Emergency)
            .where(Emergency.hospital_id == user.hospital_id)
            .order_by(Emergency.created_at.desc())
        )
    else:
        stmt = select(Emergency).order_by(Emergency.created_at.desc())
    emergencies = list((await db.execute(stmt)).scalars().all())
    result = []
    for e in emergencies:
        hospital = await db.get(Hospital, e.hospital_id) if e.hospital_id else None
        result.append(_serialize(e, hospital.name if hospital else None))
    return result


@router.patch("/{emergency_id}/resolve")
async def resolve_emergency(emergency_id: str, db: DbSession, user=Depends(get_current_user)):
    emergency = await db.get(Emergency, emergency_id)
    if not emergency:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Emergency not found")
    emergency.status = "resolved"
    if emergency.token_id:
        token = await db.get(Token, emergency.token_id)
        if token:
            token.status = "completed"
    await db.commit()
    return {"success": True, "message": "Emergency resolved"}
