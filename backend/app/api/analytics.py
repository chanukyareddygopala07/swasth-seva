import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, select

from app.core.deps import DbSession, get_current_user
from app.models.misc import AnalyticsRecord
from app.models.queue import Feedback, Queue, Token
from app.models.user import Appointment, Department, Doctor
from app.schemas.misc import AnalyticsOut, CrowdPredictionResult
from app.services.ai_service import crowd_prediction, workload_predict

router = APIRouter(tags=["analytics"])


async def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


async def _records_for(db: DbSession, hospital_id: str | None, department_id: str | None = None) -> list[AnalyticsRecord]:
    stmt = select(AnalyticsRecord)
    if hospital_id:
        stmt = stmt.where(AnalyticsRecord.hospital_id == hospital_id)
    if department_id:
        stmt = stmt.where(AnalyticsRecord.department_id == department_id)
    return list((await db.execute(stmt)).scalars().all())


async def _collect(db: DbSession, hospital_id: Optional[str]) -> AnalyticsOut:
    out = AnalyticsOut(hospital_id=hospital_id)
    records = await _records_for(db, hospital_id)
    out.total_patients = sum(r.patients_count for r in records)
    waits = [r.avg_wait_minutes for r in records if r.avg_wait_minutes]
    consults = [r.avg_consultation_minutes for r in records if r.avg_consultation_minutes]
    out.avg_wait_minutes = round(sum(waits) / len(waits), 1) if waits else 0
    out.avg_consultation_minutes = round(sum(consults) / len(consults), 1) if consults else 0
    out.emergency_count = sum(r.emergency_count for r in records)
    out.no_show_count = sum(r.no_show_count for r in records)

    by_hour: dict[int, int] = {}
    peak_by_hour: dict[int, list[float]] = {}
    for r in records:
        by_hour[r.hour] = by_hour.get(r.hour, 0) + r.patients_count
        peak_by_hour.setdefault(r.hour, []).append(r.avg_wait_minutes)
    out.patients_per_hour = [{"hour": h, "count": c} for h, c in sorted(by_hour.items())]
    out.peak_hours = [
        {"hour": h, "avg_wait": round(sum(v) / len(v), 1) if v else 0} for h, v in sorted(peak_by_hour.items())
    ]

    dept_stmt = select(Department)
    if hospital_id:
        dept_stmt = dept_stmt.where(Department.hospital_id == hospital_id)
    departments = list((await db.execute(dept_stmt)).scalars().all())
    dept_stats = []
    for d in departments:
        d_records = await _records_for(db, hospital_id, d.id)
        dept_stats.append(
            {
                "department_id": d.id,
                "name": d.name,
                "patients": sum(r.patients_count for r in d_records),
                "avg_wait": round(sum(r.avg_wait_minutes or 0 for r in d_records) / len(d_records), 1)
                if d_records
                else 0,
            }
        )
    out.department_performance = dept_stats

    doc_stmt = select(Doctor)
    if hospital_id:
        doc_stmt = doc_stmt.where(Doctor.hospital_id == hospital_id)
    doctors = list((await db.execute(doc_stmt)).scalars().all())
    today = await _today()
    doctor_stats = []
    for doc in doctors:
        start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        appts = (
            await db.execute(
                select(func.count(Appointment.id)).where(
                    Appointment.doctor_id == doc.id,
                    Appointment.status == "scheduled",
                    Appointment.scheduled_at >= start,
                    Appointment.scheduled_at < end,
                )
            )
        ).scalar_one() or 0
        completed = (
            await db.execute(
                select(func.count(Token.id))
                .join(Queue, Token.queue_id == Queue.id)
                .where(Queue.doctor_id == doc.id, Token.status == "completed")
            )
        ).scalar_one() or 0
        doctor_stats.append(
            {
                "doctor_id": doc.id,
                "name": doc.user.full_name if doc.user else None,
                "specialization": doc.specialization,
                "appointments_today": appts,
                "completed_today": completed,
                "rating": doc.rating,
                "is_available": doc.is_available,
            }
        )
    out.doctor_performance = doctor_stats

    fb_stmt = select(Feedback)
    if hospital_id:
        fb_stmt = fb_stmt.where(Feedback.hospital_id == hospital_id)
    feedbacks = list((await db.execute(fb_stmt)).scalars().all())
    sentiments: dict[str, int] = {}
    for f in feedbacks:
        sentiments[f.sentiment] = sentiments.get(f.sentiment, 0) + 1
    out.feedback_summary = {
        "count": len(feedbacks),
        "avg_rating": round(sum(f.rating for f in feedbacks) / len(feedbacks), 2) if feedbacks else 0,
        "sentiments": sentiments,
    }

    daily: dict[str, int] = {}
    for r in records:
        daily[r.date] = daily.get(r.date, 0) + r.patients_count
    out.daily_trend = [{"date": d, "count": c} for d, c in sorted(daily.items())]
    out.occupancy_history = [
        {"date": r.date, "hour": r.hour, "occupancy": r.occupancy_pct} for r in records if r.occupancy_pct
    ]
    if hospital_id:
        try:
            out.predicted_crowd = CrowdPredictionResult(**await crowd_prediction(db, hospital_id))
        except Exception:
            out.predicted_crowd = None
    return out


@router.get("/analytics", response_model=AnalyticsOut)
async def get_analytics(db: DbSession, hospital_id: Optional[str] = Query(None), user=Depends(get_current_user)):
    return await _collect(db, hospital_id)


@router.get("/analytics/export/csv")
async def export_csv(db: DbSession, hospital_id: Optional[str] = Query(None), user=Depends(get_current_user)):
    analytics = await _collect(db, hospital_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["metric", "value"])
    writer.writerow(["total_patients", analytics.total_patients])
    writer.writerow(["avg_wait_minutes", analytics.avg_wait_minutes])
    writer.writerow(["avg_consultation_minutes", analytics.avg_consultation_minutes])
    writer.writerow(["emergency_count", analytics.emergency_count])
    writer.writerow(["no_show_count", analytics.no_show_count])
    writer.writerow([])
    writer.writerow(["hour", "patients"])
    for row in analytics.patients_per_hour:
        writer.writerow([row["hour"], row["count"]])
    writer.writerow([])
    writer.writerow(["department", "patients", "avg_wait"])
    for row in analytics.department_performance:
        writer.writerow([row["name"], row["patients"], row["avg_wait"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=swasth-analytics.csv"},
    )


@router.get("/analytics/export/json")
async def export_json(db: DbSession, hospital_id: Optional[str] = Query(None), user=Depends(get_current_user)):
    analytics = await _collect(db, hospital_id)
    return JSONResponse(analytics.model_dump(mode="json"))


@router.get("/admin/doctor-workload/{doctor_id}")
async def doctor_workload(doctor_id: str, db: DbSession, user=Depends(get_current_user)):
    try:
        return await workload_predict(db, doctor_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
