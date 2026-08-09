import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.models import (
    crowd_model,
    no_show_model,
    predict_triage,
    predict_wait_time,
    triage_model,
    waiting_time_model,
    workload_model,
)
from app.ai.recommend import score_hospital, suggest_departments
from app.ai.sentiment import sentiment_model
from app.models.misc import AnalyticsRecord
from app.models.queue import Emergency, Feedback, Token
from app.models.user import Department, Doctor, Hospital, Patient

LEVEL_ORDER = {"green": 0, "yellow": 1, "orange": 2, "red": 3}

LEVEL_ADVICE = {
    "green": "Non-urgent. Routine consultation is fine. Please follow normal queue.",
    "yellow": "Mild urgency. You may wait briefly; drink water and monitor symptoms.",
    "orange": "Urgent. Please go to the emergency desk immediately. You will be prioritized.",
    "red": "CRITICAL. Emergency care required now. Call 108/ambulance or proceed to ER immediately.",
}


def triage_result(symptoms: list[str], age: Optional[int] = None, vitals: dict | None = None) -> dict:
    pred = predict_triage(symptoms, age, vitals)
    level = pred["level"]
    return {
        "level": level,
        "score": pred["score"],
        "priority_order": LEVEL_ORDER[level],
        "matching_symptoms": symptoms,
        "recommendation": LEVEL_ADVICE[level],
        "model": pred.get("model", "heuristic"),
    }


async def wait_prediction(db: AsyncSession, queue_id: Optional[str] = None, hospital_id: Optional[str] = None,
                         department_id: Optional[str] = None, queue_size: Optional[int] = None,
                         doctors_count: Optional[int] = None, avg_consultation_minutes: Optional[int] = None,
                         emergency_count: Optional[int] = 0) -> dict:
    if queue_id:
        stmt = (
            select(func.count(Token.id))
            .where(Token.queue_id == queue_id, Token.status.in_(["waiting", "called"]))
        )
        queue_size = queue_size if queue_size is not None else (await db.execute(stmt)).scalar_one() or 0
    elif hospital_id and department_id:
        from app.models.queue import Queue

        today = datetime.now(timezone.utc).date().isoformat()
        q_stmt = select(Queue).where(Queue.hospital_id == hospital_id, Queue.department_id == department_id, Queue.date == today, Queue.is_active.is_(True))
        q = (await db.execute(q_stmt)).scalar_one_or_none()
        if q:
            stmt = select(func.count(Token.id)).where(Token.queue_id == q.id, Token.status.in_(["waiting", "called"]))
            queue_size = (await db.execute(stmt)).scalar_one() or 0
            queue_id = q.id
    if avg_consultation_minutes is None and department_id:
        dept = await db.get(Department, department_id)
        avg_consultation_minutes = dept.avg_consultation_minutes if dept else 10
    if doctors_count is None and hospital_id and department_id:
        stmt = select(func.count(Doctor.id)).where(Doctor.hospital_id == hospital_id, Doctor.department_id == department_id, Doctor.is_available.is_(True))
        doctors_count = (await db.execute(stmt)).scalar_one() or 1
    if emergency_count is None and hospital_id:
        today = datetime.now(timezone.utc).date().isoformat()
        stmt = select(func.count(Emergency.id)).where(Emergency.hospital_id == hospital_id, Emergency.status == "open")
        emergency_count = (await db.execute(stmt)).scalar_one() or 0
    now = datetime.now(timezone.utc)
    result = predict_wait_time(
        queue_size=queue_size or 0,
        avg_consultation_minutes=avg_consultation_minutes or 10,
        emergency_count=emergency_count or 0,
        hour=now.hour,
        day_of_week=now.weekday(),
        doctors_count=doctors_count or 1,
    )
    result["queue_id"] = queue_id
    return result


async def recommend_hospitals(
    db: AsyncSession,
    symptoms: list[str],
    lat: Optional[float],
    lng: Optional[float],
    city: Optional[str],
    limit: int = 5,
    department_keyword: Optional[str] = None,
) -> list[dict]:
    suggested = suggest_departments(symptoms) if symptoms else []
    if department_keyword:
        suggested = [d for d in suggested if department_keyword.lower() in d.lower()] or suggested

    stmt = select(Hospital).where(Hospital.is_active.is_(True))
    if city:
        stmt = stmt.where(func.lower(Hospital.city) == city.lower())
    hospitals = list((await db.execute(stmt)).scalars().all())

    today = datetime.now(timezone.utc).date().isoformat()
    results = []
    for h in hospitals:
        distance = None
        if lat is not None and lng is not None and h.lat is not None and h.lng is not None:
            distance = haversine(lat, lng, h.lat, h.lng)
        dept_stmt = select(Department).where(Department.hospital_id == h.id, Department.is_active.is_(True))
        depts = list((await db.execute(dept_stmt)).scalars().all())
        match = bool(suggested) and any(s.lower() in (d.name or "").lower() for d in depts for s in suggested)
        waiting = 0
        from app.models.queue import Queue

        q_stmt = select(Queue.id).where(Queue.hospital_id == h.id, Queue.date == today, Queue.is_active.is_(True))
        q_ids = [r for r in (await db.execute(q_stmt)).scalars().all()]
        if q_ids:
            waiting_stmt = select(func.count(Token.id)).where(Token.queue_id.in_(q_ids), Token.status.in_(["waiting", "called"]))
            waiting = (await db.execute(waiting_stmt)).scalar_one() or 0
        doc_stmt = select(func.count(Doctor.id)).where(Doctor.hospital_id == h.id, Doctor.is_available.is_(True))
        docs_available = (await db.execute(doc_stmt)).scalar_one() or 0
        eta = None
        if distance is not None:
            eta = int(distance / 30 * 60) + 2
        score = score_hospital(h, distance, waiting, docs_available, match)
        results.append(
            {
                "id": h.id,
                "name": h.name,
                "slug": h.slug,
                "description": h.description,
                "address": h.address,
                "city": h.city,
                "state": h.state,
                "lat": h.lat,
                "lng": h.lng,
                "phone": h.phone,
                "email": h.email,
                "image_url": h.image_url,
                "rating": h.rating,
                "beds": h.beds,
                "occupancy_pct": h.occupancy_pct,
                "amenities": h.amenities,
                "distance_km": round(distance, 1) if distance is not None else None,
                "eta_minutes": eta,
                "doctors_count": docs_available,
                "departments_count": len(depts),
                "waiting_count": waiting,
                "department_match": match,
                "recommendation_score": score,
            }
        )
    results.sort(key=lambda r: -(r["recommendation_score"] or 0))
    return results[:limit]


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


async def crowd_prediction(db: AsyncSession, hospital_id: str) -> dict:
    hospital = await db.get(Hospital, hospital_id)
    today = datetime.now(timezone.utc).date().isoformat()
    stmt = select(AnalyticsRecord).where(AnalyticsRecord.hospital_id == hospital_id, AnalyticsRecord.date == today).order_by(AnalyticsRecord.hour.asc())
    records = list((await db.execute(stmt)).scalars().all())
    history = [(r.hour, r.patients_count) for r in records]
    current = sum(r.patients_count for r in records)
    predictions = crowd_model.predict(hospital_id, history, current)
    peak = max(predictions, key=lambda p: p["expected_occupancy"])["hour"] if predictions else "11:00"
    return {
        "hospital_id": hospital_id,
        "hospital_name": hospital.name if hospital else None,
        "current_occupancy": current,
        "predictions": predictions,
        "peak_hour": peak,
        "recommendation": f"Peak expected around {peak}. Consider extra staff and open a second queue window.",
    }


async def no_show_predict(db: AsyncSession, patient_id: Optional[str] = None, age: Optional[int] = None,
                          day_of_week: Optional[int] = None, hour: Optional[int] = None,
                          distance_km: Optional[float] = 5.0, prior_no_shows: Optional[int] = 0) -> dict:
    if age is None and patient_id:
        patient = await db.get(Patient, patient_id)
        if patient and patient.dob:
            age = (datetime.now(timezone.utc).date() - patient.dob).days // 365
    now = datetime.now(timezone.utc)
    return no_show_model.predict(
        age=age or 30,
        day_of_week=day_of_week if day_of_week is not None else now.weekday(),
        hour=hour if hour is not None else now.hour,
        distance_km=distance_km or 5.0,
        prior_no_shows=prior_no_shows or 0,
    )


async def workload_predict(db: AsyncSession, doctor_id: str) -> dict:
    doctor = await db.get(Doctor, doctor_id)
    if doctor is None:
        raise ValueError("Doctor not found")
    from app.models.user import Appointment

    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    stmt = select(func.count(Appointment.id)).where(
        Appointment.doctor_id == doctor_id,
        Appointment.status == "scheduled",
        Appointment.scheduled_at >= start,
        Appointment.scheduled_at < end,
    )
    count = (await db.execute(stmt)).scalar_one() or 0
    now = datetime.now(timezone.utc)
    result = workload_model.predict(
        appointments_today=count,
        avg_consultation=doctor.avg_consultation_minutes,
        day_of_week=now.weekday(),
        hour=now.hour,
    )
    result["doctor_id"] = doctor_id
    result["doctor_name"] = doctor.user.full_name if doctor.user else None
    return result


def analyze_sentiment(text: str) -> dict:
    return sentiment_model.predict(text)
