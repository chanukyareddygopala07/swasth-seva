from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.deps import DbSession, get_current_user
from app.core.deps import generate_temp_password
from app.core.security import hash_password
from app.models.misc import AppSettings, AuditLog
from app.models.user import Doctor, Hospital, Patient, User
from app.schemas.user import UserOut

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


async def _require_superadmin(user: User) -> None:
    if user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super admin only")


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: DbSession,
    user=Depends(get_current_user),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    await _require_superadmin(user)
    stmt = select(User).order_by(User.created_at.desc())
    if role:
        stmt = stmt.where(User.role == role)
    if search:
        stmt = stmt.where(User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    users = list((await db.execute(stmt)).scalars().all())
    return [
        UserOut(
            id=u.id, email=u.email, phone=u.phone, full_name=u.full_name, role=u.role,
            is_verified=u.is_verified, language=u.language, theme=u.theme, avatar_url=u.avatar_url,
            hospital_id=u.hospital_id, created_at=u.created_at,
        )
        for u in users
    ]


@router.post("/users")
async def create_user(
    db: DbSession,
    user=Depends(get_current_user),
    full_name: str = Query(...),
    email: str = Query(...),
    role: str = Query(..., pattern="^(patient|doctor|receptionist|admin)$"),
    hospital_id: Optional[str] = Query(None),
    password: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
):
    await _require_superadmin(user)
    existing = await db.execute(select(User).where(User.email == email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    pw = password or generate_temp_password()
    new_user = User(
        email=email.lower(),
        phone=phone,
        full_name=full_name,
        password_hash=hash_password(pw),
        role=role,
        hospital_id=hospital_id,
        is_verified=True,
    )
    db.add(new_user)
    await db.flush()
    if role == "patient":
        db.add(Patient(user_id=new_user.id))
    if role == "doctor" and hospital_id:
        db.add(Doctor(user_id=new_user.id, hospital_id=hospital_id))
    db.add(AuditLog(user_id=user.id, action="user.create", entity="user", entity_id=new_user.id, details={"email": email.lower(), "role": role}))
    await db.commit()
    return {"success": True, "message": "User created", "temporary_password": pw if not password else None}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    db: DbSession,
    user=Depends(get_current_user),
    full_name: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    await _require_superadmin(user)
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if full_name:
        target.full_name = full_name
    if role:
        target.role = role
    if hospital_id is not None:
        target.hospital_id = hospital_id or None
    if is_active is not None:
        target.is_active = is_active
    db.add(AuditLog(user_id=user.id, action="user.update", entity="user", entity_id=user_id, details={"role": role, "is_active": is_active}))
    await db.commit()
    return {"success": True, "message": "User updated"}


@router.get("/audit-logs")
async def audit_logs(
    db: DbSession,
    user=Depends(get_current_user),
    action: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    await _require_superadmin(user)
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    logs = list((await db.execute(stmt)).scalars().all())
    result = []
    for log in logs:
        actor = await db.get(User, log.user_id) if log.user_id else None
        result.append(
            {
                "id": log.id,
                "action": log.action,
                "entity": log.entity,
                "entity_id": log.entity_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "created_at": log.created_at,
                "user_email": actor.email if actor else None,
            }
        )
    return result


@router.get("/settings")
async def get_settings(db: DbSession, user=Depends(get_current_user)):
    await _require_superadmin(user)
    rows = (await db.execute(select(AppSettings))).scalars().all()
    return {r.key: r.value for r in rows}


@router.put("/settings/{key}")
async def set_setting(key: str, value: str, db: DbSession, user=Depends(get_current_user)):
    await _require_superadmin(user)
    row = await db.get(AppSettings, key)
    if row:
        row.value = value
    else:
        db.add(AppSettings(key=key, value=value))
    db.add(AuditLog(user_id=user.id, action="settings.update", entity="settings", entity_id=key, details={"value": value}))
    await db.commit()
    return {"success": True, "key": key}


@router.get("/global-analytics")
async def global_analytics(db: DbSession, user=Depends(get_current_user)):
    await _require_superadmin(user)
    total_hospitals = (await db.execute(select(func.count(Hospital.id)).where(Hospital.is_active.is_(True)))).scalar_one()
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_doctors = (await db.execute(select(func.count(Doctor.id)))).scalar_one()
    total_patients = (await db.execute(select(func.count(Patient.id)))).scalar_one()
    hospitals = list((await db.execute(select(Hospital).where(Hospital.is_active.is_(True)).order_by(Hospital.occupancy_pct.desc()).limit(10))).scalars().all())
    return {
        "totals": {
            "hospitals": total_hospitals,
            "users": total_users,
            "doctors": total_doctors,
            "patients": total_patients,
        },
        "top_hospitals": [
            {"id": h.id, "name": h.name, "city": h.city, "occupancy_pct": h.occupancy_pct, "rating": h.rating}
            for h in hospitals
        ],
    }
