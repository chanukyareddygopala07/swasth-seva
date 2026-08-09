from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.models.queue import Feedback, MedicalRecord, Prescription, Token
from app.models.user import Doctor, Hospital, Patient, User
from app.schemas.clinical import FeedbackCreate, FeedbackOut
from app.services.ai_service import analyze_sentiment

router = APIRouter(tags=["feedback"])


def _serialize(feedback: Feedback, hospital_name: str | None = None, patient_name: str | None = None) -> FeedbackOut:
    out = FeedbackOut.model_validate(feedback)
    out.hospital_name = hospital_name
    out.patient_name = patient_name
    return out


@router.post("/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
async def create_feedback(payload: FeedbackCreate, db: DbSession, user=Depends(get_current_user)):
    patient = (await db.execute(select(Patient).where(Patient.user_id == user.id))).scalar_one_or_none()
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient profile not found")
    sentiment = analyze_sentiment(payload.comment or "") if payload.comment else {"sentiment": "neutral", "score": 0.5}
    feedback = Feedback(
        patient_id=patient.id,
        hospital_id=payload.hospital_id,
        doctor_id=payload.doctor_id,
        token_id=payload.token_id,
        rating=payload.rating,
        comment=payload.comment,
        sentiment=sentiment["sentiment"],
        sentiment_score=sentiment["score"],
    )
    db.add(feedback)
    await db.flush()
    await db.commit()
    await db.refresh(feedback)
    hospital = await db.get(Hospital, feedback.hospital_id)
    return _serialize(feedback, hospital.name if hospital else None)


@router.get("/feedback", response_model=list[FeedbackOut])
async def list_feedback(
    db: DbSession,
    user=Depends(get_current_user),
    hospital_id: str | None = None,
    limit: int = 100,
):
    if user.role == "patient":
        patient = (await db.execute(select(Patient).where(Patient.user_id == user.id))).scalar_one_or_none()
        if not patient:
            return []
        stmt = select(Feedback).where(Feedback.patient_id == patient.id)
    elif user.role in ("admin", "receptionist", "super_admin"):
        stmt = select(Feedback)
        if hospital_id or user.hospital_id:
            stmt = stmt.where(Feedback.hospital_id == (hospital_id or user.hospital_id))
    else:
        stmt = select(Feedback).where(Feedback.hospital_id == (hospital_id or user.hospital_id or ""))
    stmt = stmt.order_by(Feedback.created_at.desc()).limit(limit)
    feedbacks = list((await db.execute(stmt)).scalars().all())
    result = []
    for f in feedbacks:
        hospital = await db.get(Hospital, f.hospital_id)
        patient = await db.get(Patient, f.patient_id)
        patient_name = None
        if patient:
            patient_user = await db.get(User, patient.user_id)
            patient_name = patient_user.full_name if patient_user else None
        result.append(_serialize(f, hospital.name if hospital else None, patient_name))
    return result
