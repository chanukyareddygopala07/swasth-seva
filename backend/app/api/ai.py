from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.models.user import Department, Hospital
from app.schemas.misc import (
    CrowdPredictionResult,
    NoShowRequest,
    NoShowResult,
    RecommendationRequest,
    SentimentRequest,
    SentimentResult,
    TriageRequest,
    TriageResult,
    WaitPredictionRequest,
    WaitPredictionResult,
)
from app.services.ai_service import (
    crowd_prediction,
    no_show_predict,
    recommend_hospitals,
    triage_result,
    wait_prediction,
)
from app.ai.sentiment import sentiment_model

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/triage", response_model=TriageResult)
async def triage(payload: TriageRequest, db: DbSession):
    if not payload.symptoms:
        raise HTTPException(400, "Provide at least one symptom")
    return triage_result(payload.symptoms, payload.age, payload.vitals)


@router.post("/wait-prediction", response_model=WaitPredictionResult)
async def wait_time(payload: WaitPredictionRequest, db: DbSession):
    result = await wait_prediction(
        db,
        queue_id=payload.queue_id,
        hospital_id=payload.hospital_id,
        department_id=payload.department_id,
        queue_size=payload.queue_size,
        doctors_count=payload.doctors_count,
        avg_consultation_minutes=payload.avg_consultation_minutes,
        emergency_count=payload.emergency_count,
    )
    if payload.queue_size is not None:
        result["patients_ahead"] = payload.queue_size
    else:
        result["patients_ahead"] = payload.queue_size or 0
    recommendation = "Low load — short wait expected."
    if result["predicted_wait_minutes"] > 60:
        recommendation = "High load — consider visiting during off-peak hours or another hospital."
    elif result["predicted_wait_minutes"] > 30:
        recommendation = "Moderate load — expect a moderate wait."
    result["recommendation"] = recommendation
    return result


@router.post("/hospital-recommendation")
async def hospital_recs(payload: RecommendationRequest, db: DbSession):
    hospitals = await recommend_hospitals(
        db,
        payload.symptoms,
        payload.lat,
        payload.lng,
        payload.city,
        payload.limit,
        payload.department_keyword,
    )
    return {"recommendations": hospitals, "suggested_departments": _suggest_departments(payload.symptoms)}


def _suggest_departments(symptoms: list[str]) -> list[str]:
    from app.ai.recommend import suggest_departments

    return suggest_departments(symptoms)


@router.get("/crowd-prediction/{hospital_id}", response_model=CrowdPredictionResult)
async def crowd(hospital_id: str, db: DbSession):
    return await crowd_prediction(db, hospital_id)


@router.post("/no-show", response_model=NoShowResult)
async def no_show(payload: NoShowRequest, db: DbSession):
    return await no_show_predict(
        db,
        patient_id=payload.patient_id,
        age=payload.age,
        day_of_week=payload.day_of_week,
        hour=payload.hour,
        distance_km=payload.distance_km,
        prior_no_shows=payload.prior_no_shows,
    )


@router.post("/sentiment", response_model=SentimentResult)
async def sentiment(payload: SentimentRequest):
    if not payload.text.strip():
        raise HTTPException(400, "Text required")
    return sentiment_model.predict(payload.text)


@router.post("/sentiment/batch")
async def sentiment_batch(texts: list[str], db: DbSession):
    return [sentiment_model.predict(t) for t in texts]
