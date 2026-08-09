import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.core.rate_limit import rate_limit
from app.core.security import (
    create_access_token,
    create_otp_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    hash_password,
    verify_password,
)
from app.models.misc import AppSettings
from app.models.user import Doctor, Hospital, Patient, User
from app.schemas.auth import (
    AuthResponse,
    ChangePassword,
    ForgotPassword,
    LoginRequest,
    OTPSend,
    RefreshRequest,
    RegisterHospitalStaff,
    RegisterPatient,
    ResetPassword,
    TokenPair,
    VerifyOTP,
)
from app.schemas.user import UserOut
from app.services.notification import send_email, send_sms

router = APIRouter(prefix="/auth", tags=["auth"])

PENDING_OTP: dict[str, str] = {}

rate_limit_dep = rate_limit(10, 60)


def _user_out(user: User, patient: Patient | None = None, doctor: Doctor | None = None) -> UserOut:
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
        patient_id=patient.id if patient else None,
        doctor_id=doctor.id if doctor else None,
    )


def _send_otp_email(email: str, otp: str, purpose: str) -> None:
    send_email(
        email,
        f"Your Swasth Seva verification code: {otp}",
        f"<h2>Swasth Seva</h2><p>Your one-time code for {purpose} is:</p><h1 style='letter-spacing:6px'>{otp}</h1><p>It expires in 10 minutes.</p>",
    )


async def _get_patient(db, user: User) -> Patient | None:
    stmt = select(Patient).where(Patient.user_id == user.id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _get_doctor(db, user: User) -> Doctor | None:
    stmt = select(Doctor).where(Doctor.user_id == user.id)
    return (await db.execute(stmt)).scalar_one_or_none()


@router.post("/register/patient", response_model=AuthResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit_dep)])
async def register_patient(payload: RegisterPatient, db: DbSession):
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(
        email=payload.email.lower(),
        phone=payload.phone,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role="patient",
        language=payload.language,
        theme=payload.theme,
    )
    db.add(user)
    await db.flush()
    patient = Patient(user_id=user.id)
    db.add(patient)
    await db.flush()
    await _send_verification(user, db, "verify")
    tokens = _tokens_for(user)
    await db.commit()
    return AuthResponse(user=_user_out(user, patient), tokens=tokens)


@router.post("/register/hospital", response_model=AuthResponse)
async def register_hospital(payload: RegisterHospitalStaff, db: DbSession):
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    hospital = Hospital(
        name=payload.hospital_name,
        slug=re.sub(r"[^a-z0-9]+", "-", payload.hospital_name.lower()).strip("-"),
        city=payload.hospital_city,
        address=payload.hospital_address,
        phone=payload.hospital_phone,
    )
    db.add(hospital)
    await db.flush()
    user = User(
        email=payload.email.lower(),
        phone=payload.phone,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        hospital_id=hospital.id,
    )
    db.add(user)
    await db.flush()
    await _send_verification(user, db, "verify")
    tokens = _tokens_for(user)
    await db.commit()
    return AuthResponse(user=_user_out(user), tokens=tokens)


def _tokens_for(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.role),
    )


@router.post("/login", response_model=AuthResponse, dependencies=[Depends(rate_limit_dep)])
async def login(payload: LoginRequest, db: DbSession):
    stmt = select(User).where(User.email == payload.email.lower())
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled. Contact support.")
    patient = await _get_patient(db, user)
    doctor = await _get_doctor(db, user)
    tokens = _tokens_for(user)
    return AuthResponse(user=_user_out(user, patient, doctor), tokens=tokens)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: DbSession):
    data = decode_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = await db.get(User, data["sub"])
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return _tokens_for(user)


@router.post("/send-otp", dependencies=[Depends(rate_limit_dep)])
async def send_otp(payload: OTPSend, db: DbSession):
    stmt = select(User).where(User.email == payload.email.lower())
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No account found with this email")
    await _send_verification(user, db, payload.purpose)
    return {"success": True, "message": "OTP sent"}


async def _send_verification(user: User, db, purpose: str) -> None:
    otp = generate_otp()
    PENDING_OTP[user.email] = otp
    _send_otp_email(user.email, otp, purpose)
    if user.phone:
        send_sms(user.phone, f"Swasth Seva OTP: {otp} (valid 10 min)")
    try:
        from redis import Redis

        client = Redis.from_url("redis://localhost:6379/0")
    except Exception:
        client = None
    if client is not None:
        try:
            client.setex(f"otp:{user.email}:{purpose}", 600, otp)
        except Exception:
            pass


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTP, db: DbSession):
    stmt = select(User).where(User.email == payload.email.lower())
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    expected = PENDING_OTP.get(user.email)
    if expected is None or expected != payload.otp:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OTP")
    if payload.purpose == "verify":
        user.is_verified = True
    PENDING_OTP.pop(user.email, None)
    await db.commit()
    return {"success": True, "message": "Verification successful"}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPassword, db: DbSession):
    stmt = select(User).where(User.email == payload.email.lower())
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No account found with this email")
    await _send_verification(user, db, "reset")
    return {"success": True, "message": "Reset code sent to your email"}


@router.post("/reset-password")
async def reset_password(payload: ResetPassword, db: DbSession):
    stmt = select(User).where(User.email == payload.email.lower())
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    expected = PENDING_OTP.get(user.email)
    if expected is None or expected != payload.otp:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OTP")
    user.password_hash = hash_password(payload.new_password)
    PENDING_OTP.pop(user.email, None)
    await db.commit()
    return {"success": True, "message": "Password updated. Please login again."}


@router.post("/change-password")
async def change_password(payload: ChangePassword, db: DbSession, user=Depends(get_current_user)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    return {"success": True, "message": "Password changed"}


@router.get("/me", response_model=UserOut)
async def me(db: DbSession, user=Depends(get_current_user)):
    patient = await _get_patient(db, user)
    doctor = await _get_doctor(db, user)
    return _user_out(user, patient, doctor)

