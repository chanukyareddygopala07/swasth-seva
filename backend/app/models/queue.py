from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import Hospital, Patient, gen_uuid, utcnow


class Queue(Base):
    __tablename__ = "queues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    hospital_id: Mapped[str] = mapped_column(ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), index=True)
    doctor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("doctors.id", ondelete="SET NULL"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    next_token: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    hospital: Mapped["Hospital"] = relationship(back_populates="queues")
    department: Mapped["Department"] = relationship(back_populates="queues")
    doctor: Mapped[Optional["Doctor"]] = relationship(lazy="selectin")
    tokens: Mapped[List["Token"]] = relationship(back_populates="queue", cascade="all, delete-orphan")


class Token(Base):
    __tablename__ = "tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    queue_id: Mapped[str] = mapped_column(ForeignKey("queues.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[Optional[str]] = mapped_column(ForeignKey("patients.id", ondelete="SET NULL"), index=True)
    appointment_id: Mapped[Optional[str]] = mapped_column(ForeignKey("appointments.id", ondelete="SET NULL"))
    token_number: Mapped[int] = mapped_column(Integer, index=True)
    priority: Mapped[str] = mapped_column(String(10), default="green", index=True)
    triage_score: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="waiting", index=True)
    is_walk_in: Mapped[bool] = mapped_column(Boolean, default=False)
    symptoms: Mapped[List[str]] = mapped_column(JSON, default=list)
    predicted_wait_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    actual_wait_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    called_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    queue: Mapped[Queue] = relationship(back_populates="tokens")
    patient: Mapped[Optional["Patient"]] = relationship()


class Emergency(Base):
    __tablename__ = "emergencies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    patient_id: Mapped[Optional[str]] = mapped_column(ForeignKey("patients.id", ondelete="SET NULL"), index=True)
    hospital_id: Mapped[Optional[str]] = mapped_column(ForeignKey("hospitals.id", ondelete="SET NULL"), index=True)
    token_id: Mapped[Optional[str]] = mapped_column(ForeignKey("tokens.id", ondelete="SET NULL"))
    triage_level: Mapped[str] = mapped_column(String(10), default="orange", index=True)
    symptoms: Mapped[List[str]] = mapped_column(JSON, default=list)
    description: Mapped[Optional[str]] = mapped_column(Text)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lng: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    patient: Mapped[Optional[Patient]] = relationship(lazy="selectin")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    doctor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("doctors.id", ondelete="SET NULL"), index=True)
    hospital_id: Mapped[str] = mapped_column(ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    diagnosis: Mapped[Optional[str]] = mapped_column(Text)
    symptoms: Mapped[List[str]] = mapped_column(JSON, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    vitals: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    patient: Mapped[Patient] = relationship(back_populates="records", lazy="selectin")
    prescriptions: Mapped[List["Prescription"]] = relationship(back_populates="record", cascade="all, delete-orphan")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    record_id: Mapped[str] = mapped_column(ForeignKey("medical_records.id", ondelete="CASCADE"), index=True)
    medicine: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[Optional[str]] = mapped_column(String(100))
    frequency: Mapped[Optional[str]] = mapped_column(String(100))
    duration: Mapped[Optional[str]] = mapped_column(String(100))
    instructions: Mapped[Optional[str]] = mapped_column(Text)
    is_refill: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_time: Mapped[Optional[str]] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    record: Mapped[MedicalRecord] = relationship(back_populates="prescriptions")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    hospital_id: Mapped[str] = mapped_column(ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    doctor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("doctors.id", ondelete="SET NULL"))
    token_id: Mapped[Optional[str]] = mapped_column(ForeignKey("tokens.id", ondelete="SET NULL"))
    rating: Mapped[int] = mapped_column(Integer, default=5)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    sentiment: Mapped[str] = mapped_column(String(10), default="neutral")
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    patient: Mapped[Patient] = relationship()
    hospital: Mapped[Hospital] = relationship(lazy="selectin")
