"""Seed the database with demo data. Idempotent: skips records that already exist.

Usage: python -m app.seed
"""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.config import settings
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models.misc import AppSettings, AuditLog, City, Lab, MedicationReminder, Notification, Pharmacy
from app.models.misc import AnalyticsRecord
from app.models.queue import Emergency, Feedback, MedicalRecord, Prescription, Queue, Token
from app.models.user import Appointment, Department, Doctor, Hospital, Patient, User

CITIES = [
    ("Hyderabad", "Telangana", 17.3850, 78.4867),
    ("Bengaluru", "Karnataka", 12.9716, 77.5946),
    ("Chennai", "Tamil Nadu", 13.0827, 80.2707),
    ("Mumbai", "Maharashtra", 19.0760, 72.8777),
    ("Delhi", "Delhi", 28.7041, 77.1025),
    ("Pune", "Maharashtra", 18.5204, 73.8567),
]

HOSPITALS = [
    {
        "name": "Apollo Health City",
        "city": "Hyderabad", "state": "Telangana",
        "lat": 17.4268, "lng": 78.4170,
        "address": "Jubilee Hills, Hyderabad",
        "rating": 4.7, "beds": 420, "occupancy_pct": 72,
        "amenities": ["24x7 Emergency", "Pharmacy", "ICU", "Ambulance", "Cafeteria", "Parking"],
    },
    {
        "name": "Sunrise Multispeciality Hospital",
        "city": "Hyderabad", "state": "Telangana",
        "lat": 17.3943, "lng": 78.4780,
        "address": "Banjara Hills, Hyderabad",
        "rating": 4.5, "beds": 250, "occupancy_pct": 58,
        "amenities": ["24x7 Emergency", "Pharmacy", "Radiology", "Ambulance", "Parking"],
    },
    {
        "name": "GreenLeaf Care Hospital",
        "city": "Bengaluru", "state": "Karnataka",
        "lat": 12.9352, "lng": 77.6245,
        "address": "Indiranagar, Bengaluru",
        "rating": 4.6, "beds": 300, "occupancy_pct": 65,
        "amenities": ["24x7 Emergency", "Pharmacy", "ICU", "Ambulance", "Cafeteria"],
    },
    {
        "name": "Meridian General Hospital",
        "city": "Chennai", "state": "Tamil Nadu",
        "lat": 13.0361, "lng": 80.2418,
        "address": "T. Nagar, Chennai",
        "rating": 4.4, "beds": 180, "occupancy_pct": 49,
        "amenities": ["24x7 Emergency", "Pharmacy", "Ambulance"],
    },
    {
        "name": "Nova Institute of Medical Sciences",
        "city": "Pune", "state": "Maharashtra",
        "lat": 18.5211, "lng": 73.8567,
        "address": "Kothrud, Pune",
        "rating": 4.8, "beds": 500, "occupancy_pct": 81,
        "amenities": ["24x7 Emergency", "Pharmacy", "ICU", "Ambulance", "Cafeteria", "Parking", "Wheelchair"],
    },
    {
        "name": "Lotus Children's Hospital",
        "city": "Mumbai", "state": "Maharashtra",
        "lat": 19.1176, "lng": 72.9060,
        "address": "Andheri West, Mumbai",
        "rating": 4.5, "beds": 120, "occupancy_pct": 44,
        "amenities": ["Pediatric ICU", "Pharmacy", "Ambulance"],
    },
]

DEPARTMENTS = [
    "General Medicine", "Cardiology", "Pediatrics", "Orthopedics", "Dermatology",
    "ENT", "Ophthalmology", "Neurology", "Gynecology", "Dental",
    "Gastroenterology", "Pulmonology", "Urology", "Emergency", "Psychiatry",
]

DOCTORS = [
    ("Dr. Ramesh Kumar", "Cardiology", 18, 12),
    ("Dr. Anita Sharma", "General Medicine", 12, 10),
    ("Dr. Vikram Rao", "Orthopedics", 15, 14),
    ("Dr. Priya Nair", "Pediatrics", 10, 12),
    ("Dr. Suresh Patel", "Neurology", 20, 16),
    ("Dr. Meera Iyer", "Dermatology", 8, 9),
    ("Dr. Arjun Singh", "Gastroenterology", 14, 11),
    ("Dr. Kavitha Reddy", "Pulmonology", 11, 13),
]

USERS = [
    # (email, password, full_name, role, phone, hospital_idx or None)
    ("patient@demo.com", "Patient@123", "Ravi Teja", "patient", "+919876543201", None),
    ("doctor@demo.com", "Doctor@123", "Dr. Anita Sharma", "doctor", "+919876543202", 0),
    ("reception@demo.com", "Reception@123", "Lakshmi Devi", "receptionist", "+919876543203", 0),
    ("admin@demo.com", "Admin@123", "Hospital Admin", "admin", "+919876543204", 0),
    ("superadmin@swasthseva.app", "SuperAdmin@123", "Super Admin", "super_admin", "+919876543205", None),
    ("patient2@demo.com", "Patient@123", "Sita Ram", "patient", "+919876543206", None),
    ("doctor2@demo.com", "Doctor@123", "Dr. Ramesh Kumar", "doctor", "+919876543207", 0),
]

SYMPTOM_POOL = [
    ["fever", "headache", "body ache"],
    ["chest pain", "breathing difficulty"],
    ["cough", "cold", "sore throat"],
    ["joint pain", "back pain"],
    ["abdominal pain", "nausea"],
    ["rash", "itchy skin"],
    ["dizziness", "fatigue"],
    ["burning urination"],
]


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        count = (await db.execute(select(func.count(Hospital.id)))).scalar_one()
        if count > 0:
            print("Seed skipped: data already present.")
            return

        for name, state, lat, lng in CITIES:
            db.add(City(name=name, state=state, lat=lat, lng=lng))

        hospital_objs = []
        for h in HOSPITALS:
            hospital = Hospital(
                name=h["name"],
                slug=h["name"].lower().replace(" ", "-").replace("'", ""),
                city=h["city"], state=h["state"],
                lat=h["lat"], lng=h["lng"],
                address=h["address"],
                rating=h["rating"], beds=h["beds"], occupancy_pct=h["occupancy_pct"],
                amenities=h["amenities"],
                phone="+914012345678",
                email=f"info@{h['name'].lower().replace(' ', '')}.com",
            )
            db.add(hospital)
            hospital_objs.append(hospital)
        await db.flush()

        for i, h in enumerate(hospital_objs):
            for j, dept_name in enumerate(DEPARTMENTS):
                db.add(
                    Department(
                        hospital_id=h.id,
                        name=dept_name,
                        avg_consultation_minutes=8 + (j % 5),
                    )
                )
        await db.flush()

        user_objs = {}
        for email, password, full_name, role, phone, hidx in USERS:
            user = User(
                email=email,
                phone=phone,
                full_name=full_name,
                password_hash=hash_password(password),
                role=role,
                is_verified=True,
                hospital_id=hospital_objs[hidx].id if hidx is not None else None,
            )
            db.add(user)
            await db.flush()
            user_objs[email] = user

        patient1 = Patient(
            user_id=user_objs["patient@demo.com"].id,
            dob=datetime(1992, 5, 14).date(),
            gender="male", blood_group="B+",
            city="Hyderabad", lat=17.40, lng=78.47,
            emergency_contact="+919876543210",
            allergies=["Penicillin"],
            chronic_conditions=["Hypertension"],
            family_members=[
                {"id": "fm-1", "full_name": "Sita Ram", "relation": "Father", "blood_group": "A+"},
                {"id": "fm-2", "full_name": "Anjali Teja", "relation": "Spouse", "blood_group": "O+"},
            ],
        )
        patient2 = Patient(
            user_id=user_objs["patient2@demo.com"].id,
            dob=datetime(2000, 1, 1).date(),
            gender="male", blood_group="O+",
            city="Hyderabad", lat=17.38, lng=78.49,
        )
        db.add_all([patient1, patient2])
        await db.flush()

        doctors_objs = []
        for idx, (name, spec, exp, consult) in enumerate(DOCTORS):
            if idx == 0:
                user = user_objs["doctor@demo.com"]
                user.role = "doctor"
            elif idx == 1:
                user = user_objs["doctor2@demo.com"]
                user.role = "doctor"
            else:
                email = f"dr{idx}@demo.com"
                user = User(
                    email=email,
                    phone=f"+9198765432{20 + idx}",
                    full_name=name,
                    password_hash=hash_password("Doctor@123"),
                    role="doctor",
                    is_verified=True,
                    hospital_id=hospital_objs[idx % len(hospital_objs)].id,
                )
                db.add(user)
                await db.flush()
            user.full_name = name
            dept = (
                await db.execute(
                    select(Department).where(
                        Department.hospital_id == user.hospital_id, Department.name == spec
                    )
                )
            ).scalar_one()
            doctor = Doctor(
                user_id=user.id,
                hospital_id=user.hospital_id,
                department_id=dept.id,
                specialization=spec,
                license_number=f"L-{1000 + idx}",
                experience_years=exp,
                avg_consultation_minutes=consult,
                rating=4.4 + (idx % 4) * 0.1,
                bio=f"Senior consultant in {spec} with {exp} years of experience.",
            )
            db.add(doctor)
            await db.flush()
            doctors_objs.append(doctor)

        now = datetime.now(timezone.utc)
        today = now.date().isoformat()
        dept_map: dict[str, Department] = {}
        for h in hospital_objs:
            depts = (await db.execute(select(Department).where(Department.hospital_id == h.id))).scalars().all()
            for d in depts:
                dept_map[(h.id, d.name)] = d

        h0 = hospital_objs[0]
        queues = []
        for dept_name in ["Cardiology", "General Medicine", "Orthopedics"]:
            dept = dept_map[(h0.id, dept_name)]
            queue = Queue(hospital_id=h0.id, department_id=dept.id, date=today, is_active=True, next_token=1)
            db.add(queue)
            queues.append(queue)
        await db.flush()

        doctor0 = doctors_objs[1]  # Anita Sharma - General Medicine
        queues[1].doctor_id = doctor0.id
        await db.flush()

        token_no = 1
        for i in range(6):
            patient = patient1 if i % 2 == 0 else patient2
            queue = queues[i % len(queues)]
            symptoms = SYMPTOM_POOL[i % len(SYMPTOM_POOL)]
            priority = ["green", "green", "yellow", "green", "orange", "green"][i]
            token = Token(
                queue_id=queue.id,
                patient_id=patient.id,
                token_number=token_no,
                priority=priority,
                triage_score={"green": 0.3, "yellow": 0.5, "orange": 0.65}.get(priority, 0.3),
                status="waiting" if i < 4 else "completed",
                symptoms=symptoms,
                predicted_wait_minutes=15 + i * 7,
                created_at=now - timedelta(minutes=20 - i * 3),
            )
            if i >= 4:
                token.called_at = token.created_at + timedelta(minutes=5)
                token.completed_at = token.created_at + timedelta(minutes=18)
                token.actual_wait_minutes = 13
            token_no += 1
            db.add(token)
        queue = queues[0]
        queue.next_token = token_no
        await db.flush()

        record = MedicalRecord(
            patient_id=patient1.id,
            doctor_id=doctor0.id,
            hospital_id=h0.id,
            diagnosis="Seasonal viral fever with mild dehydration",
            symptoms=["fever", "headache"],
            notes="Rest, fluids, paracetamol for 3 days. Review if fever persists.",
            vitals={"temperature": 101.2, "pulse": 88, "spo2": 98},
        )
        db.add(record)
        await db.flush()
        db.add_all(
            [
                Prescription(record_id=record.id, medicine="Paracetamol 650mg", dosage="1 tablet", frequency="Twice daily", duration="3 days", instructions="After food", reminder_time="20:00"),
                Prescription(record_id=record.id, medicine="ORS", dosage="1 sachet", frequency="Three times daily", duration="2 days", instructions="Dissolve in 200ml water"),
            ]
        )
        db.add(
            MedicationReminder(
                patient_id=patient1.id, medicine="Paracetamol 650mg", dosage="1 tablet", reminder_time="20:00"
            )
        )

        appt = Appointment(
            patient_id=patient1.id,
            doctor_id=doctor0.id,
            hospital_id=h0.id,
            department_id=dept_map[(h0.id, "General Medicine")].id,
            scheduled_at=now + timedelta(days=1, hours=-now.hour + 10),
            status="scheduled",
            reason="Follow-up for viral fever",
        )
        db.add(appt)

        feedbacks = [
            ("Very caring staff and quick service, excellent experience", 5, 0.9),
            ("Doctor was thorough and explained everything clearly", 5, 0.85),
            ("Long waiting time, could be faster", 3, 0.35),
        ]
        for comment, rating, _ in feedbacks:
            db.add(
                Feedback(
                    patient_id=patient1.id, hospital_id=h0.id, doctor_id=doctor0.id,
                    rating=rating, comment=comment,
                    sentiment="positive" if rating >= 4 else "neutral",
                    sentiment_score=_,
                )
            )

        for hour in range(8, 20):
            pattern = 1.0 if 9 <= hour <= 12 else (0.8 if 16 <= hour <= 18 else 0.5)
            db.add(
                AnalyticsRecord(
                    hospital_id=h0.id,
                    date=today,
                    hour=hour,
                    patients_count=int(8 * pattern),
                    avg_wait_minutes=12 + hour % 9,
                    avg_consultation_minutes=10,
                    emergency_count=hour % 4,
                    occupancy_pct=min(100, 45 + hour * 2.2),
                )
            )

        db.add_all(
            [
                Pharmacy(name="MedPlus Pharmacy", city="Hyderabad", lat=17.4001, lng=78.4780, address="Jubilee Hills Rd", is_open_24h=True, rating=4.6, phone="+918000111222"),
                Pharmacy(name="Apollo Pharmacy", city="Hyderabad", lat=17.4120, lng=78.4740, address="Road No 1, Banjara Hills", rating=4.4, phone="+918000333444"),
                Lab(name="Lal Path Labs", city="Hyderabad", lat=17.4030, lng=78.4700, tests=["Blood Test", "CBC", "Lipid Profile", "Thyroid"]),
                Lab(name="Metropolis Labs", city="Hyderabad", lat=17.4200, lng=78.4850, tests=["CBC", "Blood Sugar", "Liver Function", "Kidney Function"]),
            ]
        )

        db.add(
            Notification(
                user_id=user_objs["patient@demo.com"].id,
                title="Welcome to Swasth Seva",
                body="Your digital health passport is ready. Book your first OP visit!",
                type="general",
            )
        )

        for h in hospital_objs[:2]:
            db.add(
                Notification(
                    user_id=user_objs["admin@demo.com"].id,
                    title=f"{h.name} queue opened",
                    body="Morning queues are live. AI predictions are enabled.",
                    type="general",
                )
            )

        db.add(
            AuditLog(
                user_id=user_objs["superadmin@swasthseva.app"].id,
                action="system.seed",
                entity="system",
                details={"seed": "demo-data"},
            )
        )

        db.add(AppSettings(key="maintenance_mode", value="false"))
        db.add(AppSettings(key="queue_announcements_enabled", value="true"))

        await db.commit()
        print("Seed complete: 6 cities, 6 hospitals, 15 departments, 8 doctors, 7 users, queues, tokens, records, analytics.")


async def train_models() -> None:
    from app.ai.train import train_all

    try:
        train_all()
    except Exception as exc:
        print(f"Model training skipped: {exc} (heuristics active)")


if __name__ == "__main__":
    asyncio.run(seed())
    if settings.SEED_DEMO_DATA:
        asyncio.run(train_models())
