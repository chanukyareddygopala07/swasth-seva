from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class HospitalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    image_url: Optional[str] = None
    beds: int = 0
    amenities: List[str] = []


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    image_url: Optional[str] = None
    beds: Optional[int] = None
    amenities: Optional[List[str]] = None
    is_active: Optional[bool] = None


class HospitalOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    image_url: Optional[str] = None
    rating: float = 0.0
    beds: int = 0
    occupancy_pct: float = 0.0
    is_active: bool = True
    amenities: List[str] = []
    distance_km: Optional[float] = None
    eta_minutes: Optional[int] = None
    doctors_count: Optional[int] = None
    departments_count: Optional[int] = None
    waiting_count: Optional[int] = None
    recommendation_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    avg_consultation_minutes: int = 10


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avg_consultation_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentOut(BaseModel):
    id: str
    hospital_id: str
    name: str
    description: Optional[str] = None
    avg_consultation_minutes: int = 10
    is_active: bool = True
    doctors_count: Optional[int] = None
    waiting_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class HospitalCompareOut(BaseModel):
    hospitals: List[HospitalOut]
    best: Optional[HospitalOut] = None


class CityCreate(BaseModel):
    name: str
    state: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class CityOut(BaseModel):
    id: str
    name: str
    state: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
