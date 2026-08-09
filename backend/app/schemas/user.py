from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    id: str
    email: EmailStr
    phone: Optional[str] = None
    full_name: str
    role: str
    is_verified: bool
    language: str
    theme: str
    avatar_url: Optional[str] = None
    hospital_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserOut(UserBase):
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None


class PatientUpdate(BaseModel):
    dob: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    family_members: Optional[List[dict]] = None


class FamilyMember(BaseModel):
    full_name: str
    relation: str
    dob: Optional[date] = None
    blood_group: Optional[str] = None


class DoctorAvailability(BaseModel):
    is_available: bool
    avg_consultation_minutes: Optional[int] = None


class DoctorUpdate(BaseModel):
    specialization: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    avg_consultation_minutes: Optional[int] = None


class PatientOut(BaseModel):
    id: str
    dob: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    emergency_contact: Optional[str] = None
    allergies: List[str] = []
    chronic_conditions: List[str] = []
    family_members: List[dict] = []
    qr_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DoctorOut(BaseModel):
    id: str
    user_id: str
    full_name: Optional[str] = None
    hospital_id: str
    department_id: Optional[str] = None
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    experience_years: int = 0
    avg_consultation_minutes: int = 10
    rating: float = 0.0
    is_available: bool = True
    bio: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DoctorDetail(DoctorOut):
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
