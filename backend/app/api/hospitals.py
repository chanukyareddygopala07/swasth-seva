from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.core.deps import DbSession, get_current_user
from app.models.user import Department, Doctor, Hospital
from app.schemas.hospital import (
    CityCreate,
    CityOut,
    DepartmentCreate,
    DepartmentOut,
    DepartmentUpdate,
    HospitalCreate,
    HospitalOut,
    HospitalUpdate,
)
from app.models.misc import City
from app.models.queue import Token
from app.models.user import User
from app.models.queue import Queue
from app.schemas.hospital import HospitalCompareOut
from app.services.maps_service import geocode

router = APIRouter(tags=["hospitals"])


def _to_out(h: Hospital, distance_km=None, eta=None) -> HospitalOut:
    return HospitalOut(
        id=h.id,
        name=h.name,
        slug=h.slug,
        description=h.description,
        address=h.address,
        city=h.city,
        state=h.state,
        lat=h.lat,
        lng=h.lng,
        phone=h.phone,
        email=h.email,
        image_url=h.image_url,
        rating=h.rating,
        beds=h.beds,
        occupancy_pct=h.occupancy_pct,
        is_active=h.is_active,
        amenities=h.amenities,
        distance_km=distance_km,
        eta_minutes=eta,
    )


@router.get("/hospitals", response_model=list[HospitalOut])
async def list_hospitals(
    db: DbSession,
    city: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("rating", pattern="^(rating|name|occupancy_pct)$"),
):
    stmt = select(Hospital).where(Hospital.is_active.is_(True))
    if city:
        stmt = stmt.where(func.lower(Hospital.city) == city.lower())
    if search:
        stmt = stmt.where(or_(Hospital.name.ilike(f"%{search}%"), Hospital.city.ilike(f"%{search}%")))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    if sort_by == "name":
        stmt = stmt.order_by(Hospital.name.asc())
    elif sort_by == "occupancy_pct":
        stmt = stmt.order_by(Hospital.occupancy_pct.desc())
    else:
        stmt = stmt.order_by(Hospital.rating.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    hospitals = list((await db.execute(stmt)).scalars().all())
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).date().isoformat()
    out = []
    for h in hospitals:
        q_stmt = select(Queue.id).where(Queue.hospital_id == h.id, Queue.date == today, Queue.is_active.is_(True))
        q_ids = [r for r in (await db.execute(q_stmt)).scalars().all()]
        waiting = 0
        if q_ids:
            w = await db.execute(select(func.count(Token.id)).where(Token.queue_id.in_(q_ids), Token.status.in_(["waiting", "called"])))
            waiting = w.scalar_one() or 0
        docs = await db.execute(select(func.count(Doctor.id)).where(Doctor.hospital_id == h.id, Doctor.is_available.is_(True)))
        depts = await db.execute(select(func.count(Department.id)).where(Department.hospital_id == h.id, Department.is_active.is_(True)))
        item = _to_out(h)
        item.doctors_count = docs.scalar_one() or 0
        item.departments_count = depts.scalar_one() or 0
        item.waiting_count = waiting
        out.append(item)
    return out


@router.get("/hospitals/{hospital_id}", response_model=HospitalOut)
async def get_hospital(hospital_id: str, db: DbSession):
    hospital = await db.get(Hospital, hospital_id)
    if not hospital:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    return _to_out(hospital)


@router.post("/hospitals", response_model=HospitalOut, status_code=status.HTTP_201_CREATED)
async def create_hospital(payload: HospitalCreate, db: DbSession, user=Depends(get_current_user)):
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can create hospitals")
    slug = payload.name.lower().replace(" ", "-").replace("&", "and")
    existing = await db.execute(select(Hospital).where(Hospital.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{payload.city or 'city'}"
    hospital = Hospital(**payload.model_dump(exclude={"email"}), slug=slug)
    if payload.email:
        hospital.email = payload.email
    if (payload.lat is None or payload.lng is None) and payload.address:
        coords = await geocode(f"{payload.address}, {payload.city or ''}")
        if coords:
            hospital.lat, hospital.lng = coords["lat"], coords["lng"]
    db.add(hospital)
    await db.commit()
    await db.refresh(hospital)
    return _to_out(hospital)


@router.patch("/hospitals/{hospital_id}", response_model=HospitalOut)
async def update_hospital(hospital_id: str, payload: HospitalUpdate, db: DbSession, user=Depends(get_current_user)):
    hospital = await db.get(Hospital, hospital_id)
    if not hospital:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(hospital, key, value)
    await db.commit()
    await db.refresh(hospital)
    return _to_out(hospital)


@router.delete("/hospitals/{hospital_id}")
async def delete_hospital(hospital_id: str, db: DbSession, user=Depends(get_current_user)):
    if user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only super admin can delete hospitals")
    hospital = await db.get(Hospital, hospital_id)
    if not hospital:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    hospital.is_active = False
    await db.commit()
    return {"success": True, "message": "Hospital deactivated"}


@router.get("/hospitals/{hospital_id}/departments", response_model=list[DepartmentOut])
async def list_departments(hospital_id: str, db: DbSession):
    stmt = select(Department).where(Department.hospital_id == hospital_id, Department.is_active.is_(True)).order_by(Department.name)
    departments = list((await db.execute(stmt)).scalars().all())
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).date().isoformat()
    out = []
    for d in departments:
        q = await db.execute(select(Queue.id).where(Queue.hospital_id == hospital_id, Queue.department_id == d.id, Queue.date == today, Queue.is_active.is_(True)))
        q_ids = [r for r in q.scalars().all()]
        waiting = 0
        if q_ids:
            w = await db.execute(select(func.count(Token.id)).where(Token.queue_id.in_(q_ids), Token.status.in_(["waiting", "called"])))
            waiting = w.scalar_one() or 0
        docs = await db.execute(select(func.count(Doctor.id)).where(Doctor.department_id == d.id, Doctor.is_available.is_(True)))
        item = DepartmentOut.model_validate(d)
        item.doctors_count = docs.scalar_one() or 0
        item.waiting_count = waiting
        out.append(item)
    return out


@router.post("/hospitals/{hospital_id}/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(hospital_id: str, payload: DepartmentCreate, db: DbSession, user=Depends(get_current_user)):
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    hospital = await db.get(Hospital, hospital_id)
    if not hospital:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    department = Department(hospital_id=hospital_id, **payload.model_dump())
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return DepartmentOut.model_validate(department)


@router.patch("/hospitals/{hospital_id}/departments/{department_id}", response_model=DepartmentOut)
async def update_department(hospital_id: str, department_id: str, payload: DepartmentUpdate, db: DbSession, user=Depends(get_current_user)):
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, key, value)
    await db.commit()
    await db.refresh(department)
    return DepartmentOut.model_validate(department)


@router.get("/cities", response_model=list[CityOut])
async def list_cities(db: DbSession):
    stmt = select(City).where(City.is_active.is_(True)).order_by(City.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/cities", response_model=CityOut, status_code=status.HTTP_201_CREATED)
async def create_city(payload: CityCreate, db: DbSession, user=Depends(get_current_user)):
    if user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    city = City(**payload.model_dump())
    db.add(city)
    await db.commit()
    await db.refresh(city)
    return CityOut.model_validate(city)


@router.get("/compare")
async def compare_hospitals(
    db: DbSession,
    ids: str = Query(..., description="comma separated hospital ids"),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
):
    from app.services.ai_service import haversine, recommend_hospitals

    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    hospitals: list[Hospital] = []
    for hid in id_list:
        h = await db.get(Hospital, hid)
        if h:
            hospitals.append(h)
    if not hospitals:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No hospitals found")
    out = []
    for h in hospitals:
        item = _to_out(h)
        if lat is not None and lng is not None and h.lat and h.lng:
            item.distance_km = round(haversine(lat, lng, h.lat, h.lng), 1)
            item.eta_minutes = int((item.distance_km or 1) / 30 * 60)
        out.append(item)
    best = max(out, key=lambda o: (o.rating or 0) * 10 - (o.distance_km or 10))
    return HospitalCompareOut(hospitals=out, best=best)
