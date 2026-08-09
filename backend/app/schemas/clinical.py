from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AppointmentCreate(BaseModel):
    doctor_id: Optional[str] = None
    department_id: Optional[str] = None
    hospital_id: str
    scheduled_at: datetime
    reason: Optional[str] = None
    patient_id: Optional[str] = None
    patient_phone: Optional[str] = None


class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


class AppointmentOut(BaseModel):
    id: str
    patient_id: str
    doctor_id: Optional[str] = None
    hospital_id: str
    department_id: Optional[str] = None
    scheduled_at: datetime
    status: str
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    hospital_name: Optional[str] = None
    doctor_name: Optional[str] = None
    department_name: Optional[str] = None
    token_number: Optional[int] = None
    predicted_wait_minutes: Optional[int] = None
    priority: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenCreate(BaseModel):
    hospital_id: str
    department_id: Optional[str] = None
    doctor_id: Optional[str] = None
    symptoms: List[str] = []
    is_walk_in: bool = False
    appointment_id: Optional[str] = None


class TokenOut(BaseModel):
    id: str
    queue_id: str
    token_number: int
    priority: str
    triage_score: Optional[float] = None
    status: str
    symptoms: List[str] = []
    predicted_wait_minutes: Optional[int] = None
    actual_wait_minutes: Optional[int] = None
    created_at: datetime
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None
    department_name: Optional[str] = None
    doctor_name: Optional[str] = None
    patients_ahead: Optional[int] = None
    current_token: Optional[int] = None
    triage_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenStatus(BaseModel):
    token_id: str
    status: str
    priority: Optional[str] = None


class TransferRequest(BaseModel):
    department_id: str


class EmergencyCreate(BaseModel):
    hospital_id: Optional[str] = None
    symptoms: List[str] = []
    description: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class EmergencyOut(BaseModel):
    id: str
    triage_level: str
    symptoms: List[str] = []
    description: Optional[str] = None
    location: Optional[str] = None
    status: str
    created_at: datetime
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MedicalRecordCreate(BaseModel):
    patient_id: str
    diagnosis: Optional[str] = None
    symptoms: List[str] = []
    notes: Optional[str] = None
    vitals: dict = {}
    prescriptions: List[dict] = []


class MedicalRecordOut(BaseModel):
    id: str
    patient_id: str
    doctor_id: Optional[str] = None
    hospital_id: str
    diagnosis: Optional[str] = None
    symptoms: List[str] = []
    notes: Optional[str] = None
    vitals: dict = {}
    created_at: datetime
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    prescriptions: List[dict] = []

    model_config = ConfigDict(from_attributes=True)


class FeedbackCreate(BaseModel):
    hospital_id: str
    doctor_id: Optional[str] = None
    token_id: Optional[str] = None
    rating: int = 5
    comment: Optional[str] = None


class FeedbackOut(BaseModel):
    id: str
    rating: int
    comment: Optional[str] = None
    sentiment: str
    sentiment_score: Optional[float] = None
    created_at: datetime
    hospital_name: Optional[str] = None
    patient_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PrescriptionOut(BaseModel):
    id: str
    record_id: str
    medicine: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    reminder_time: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LabBookingCreate(BaseModel):
    lab_id: Optional[str] = None
    test: str
    scheduled_at: Optional[datetime] = None


class MedicationReminderCreate(BaseModel):
    medicine: str
    dosage: Optional[str] = None
    reminder_time: str
    active: bool = True
