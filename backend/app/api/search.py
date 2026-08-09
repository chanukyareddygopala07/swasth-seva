from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.core.deps import DbSession, get_current_user
from app.models.misc import Pharmacy
from app.models.user import Department, Doctor, Hospital, Patient, User
from app.schemas.misc import SearchResults

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResults)
async def global_search(
    db: DbSession,
    q: str = Query(..., min_length=1, max_length=120),
    hospital_id: str | None = Query(None),
):
    term = f"%{q.strip()}%"
    results = SearchResults()

    hospitals = (
        await db.execute(
            select(Hospital)
            .where(Hospital.is_active.is_(True), or_(Hospital.name.ilike(term), Hospital.city.ilike(term)))
            .limit(10)
        )
    ).scalars().all()
    results.hospitals = [
        {"id": h.id, "name": h.name, "city": h.city, "slug": h.slug, "rating": h.rating} for h in hospitals
    ]

    doctor_stmt = select(Doctor).join(User, Doctor.user_id == User.id).where(
        or_(User.full_name.ilike(term), Doctor.specialization.ilike(term))
    )
    if hospital_id:
        doctor_stmt = doctor_stmt.where(Doctor.hospital_id == hospital_id)
    doctors = (await db.execute(doctor_stmt.limit(10))).scalars().all()
    results.doctors = [
        {"id": d.id, "name": d.user.full_name, "specialization": d.specialization, "hospital_id": d.hospital_id}
        for d in doctors
    ]

    departments = (
        await db.execute(
            select(Department)
            .join(Hospital, Department.hospital_id == Hospital.id)
            .where(Department.name.ilike(term), Department.is_active.is_(True))
            .limit(10)
        )
    ).scalars().all()
    results.departments = [
        {"id": d.id, "name": d.name, "hospital_id": d.hospital_id, "hospital_name": d.hospital.name if d.hospital else None}
        for d in departments
    ]

    if hospital_id and _is_staff(db):
        pass
    patients = (
        await db.execute(
            select(Patient)
            .join(User, Patient.user_id == User.id)
            .where(or_(User.full_name.ilike(term), User.phone.ilike(term)))
            .limit(10)
        )
    ).scalars().all()
    results.patients = [
        {"id": p.id, "name": p.user.full_name, "phone": p.user.phone, "email": p.user.email} for p in patients
    ]
    return results


def _is_staff(db):
    return True
