from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict


class QueueOut(BaseModel):
    id: str
    hospital_id: str
    hospital_name: Optional[str] = None
    department_id: str
    department_name: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    date: str
    is_active: bool
    next_token: int
    current_token: Optional[int] = None
    current_token_priority: Optional[str] = None
    waiting_count: int = 0
    called_count: int = 0
    completed_count: int = 0
    avg_wait_minutes: Optional[float] = None
    tokens: List[dict] = []

    model_config = ConfigDict(from_attributes=True)


class NotificationOut(BaseModel):
    id: str
    title: str
    body: Optional[str] = None
    type: str
    channel: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TriageRequest(BaseModel):
    symptoms: List[str] = []
    age: Optional[int] = None
    gender: Optional[str] = None
    vitals: dict = {}


class TriageResult(BaseModel):
    level: str
    score: float
    recommendation: str
    priority_order: int
    matching_symptoms: List[str]


class WaitPredictionRequest(BaseModel):
    queue_id: Optional[str] = None
    hospital_id: Optional[str] = None
    department_id: Optional[str] = None
    queue_size: Optional[int] = None
    doctors_count: Optional[int] = None
    avg_consultation_minutes: Optional[int] = None
    emergency_count: Optional[int] = 0
    hour: Optional[int] = None
    day_of_week: Optional[int] = None


class WaitPredictionResult(BaseModel):
    predicted_wait_minutes: int
    patients_ahead: int
    confidence: float
    factors: dict
    recommendation: str


class RecommendationRequest(BaseModel):
    symptoms: List[str] = []
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    limit: int = 5
    department_keyword: Optional[str] = None


class CrowdPredictionResult(BaseModel):
    hospital_id: str
    hospital_name: Optional[str] = None
    current_occupancy: int
    predictions: List[dict]
    peak_hour: str
    recommendation: str


class NoShowRequest(BaseModel):
    patient_id: Optional[str] = None
    age: Optional[int] = None
    day_of_week: Optional[int] = None
    hour: Optional[int] = None
    distance_km: Optional[float] = 5.0
    prior_no_shows: Optional[int] = 0


class NoShowResult(BaseModel):
    probability: float
    risk: str
    recommendation: str


class WorkloadResult(BaseModel):
    doctor_id: str
    doctor_name: Optional[str] = None
    predicted_patients: int
    load_percent: float
    status: str
    recommendation: str


class SentimentRequest(BaseModel):
    text: str


class SentimentResult(BaseModel):
    sentiment: str
    score: float
    confidence: float


class AnalyticsOut(BaseModel):
    hospital_id: Optional[str] = None
    total_patients: int = 0
    avg_wait_minutes: float = 0.0
    avg_consultation_minutes: float = 0.0
    emergency_count: int = 0
    no_show_count: int = 0
    peak_hours: List[dict] = []
    patients_per_hour: List[dict] = []
    department_performance: List[dict] = []
    doctor_performance: List[dict] = []
    feedback_summary: dict = {}
    daily_trend: List[dict] = []
    occupancy_history: List[dict] = []
    predicted_crowd: Optional[CrowdPredictionResult] = None


class SearchResults(BaseModel):
    hospitals: List[dict] = []
    doctors: List[dict] = []
    departments: List[dict] = []
    patients: List[dict] = []


class AuditLogOut(BaseModel):
    id: str
    action: str
    entity: Optional[str] = None
    entity_id: Optional[str] = None
    details: dict = {}
    ip_address: Optional[str] = None
    created_at: datetime
    user_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SettingsOut(BaseModel):
    key: str
    value: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ApiResponse(BaseModel):
    success: bool = True
    message: str = "ok"
    data: Any = None
