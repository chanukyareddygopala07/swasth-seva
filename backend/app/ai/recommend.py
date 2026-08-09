import numpy as np

from app.ai.features import encode_symptoms

SYMPTOM_DEPARTMENT_MAP = {
    "fever": ["General Medicine", "Pediatrics"],
    "cough": ["Pulmonology", "General Medicine"],
    "cold": ["General Medicine"],
    "headache": ["Neurology", "General Medicine"],
    "migraine": ["Neurology"],
    "chest pain": ["Cardiology", "Emergency"],
    "breathing difficulty": ["Pulmonology", "Emergency"],
    "shortness of breath": ["Pulmonology", "Cardiology", "Emergency"],
    "palpitations": ["Cardiology"],
    "high blood pressure": ["Cardiology", "General Medicine"],
    "dizziness": ["Neurology", "ENT"],
    "fainting": ["Cardiology", "Neurology", "Emergency"],
    "seizure": ["Neurology", "Emergency"],
    "unconsciousness": ["Emergency"],
    "abdominal pain": ["Gastroenterology", "General Medicine"],
    "stomach pain": ["Gastroenterology"],
    "vomiting": ["Gastroenterology", "General Medicine"],
    "diarrhea": ["Gastroenterology"],
    "constipation": ["Gastroenterology"],
    "heartburn": ["Gastroenterology"],
    "nausea": ["General Medicine"],
    "joint pain": ["Orthopedics", "Rheumatology"],
    "back pain": ["Orthopedics", "Neurology"],
    "fracture": ["Orthopedics", "Emergency"],
    "burn": ["Plastic Surgery", "Emergency"],
    "wound": ["General Surgery"],
    "rash": ["Dermatology"],
    "itchy skin": ["Dermatology"],
    "hair loss": ["Dermatology"],
    "allergy": ["Dermatology", "ENT"],
    "sore throat": ["ENT"],
    "ear pain": ["ENT"],
    "tooth pain": ["Dental"],
    "eye redness": ["Ophthalmology"],
    "blurred vision": ["Ophthalmology"],
    "burning urination": ["Urology", "Nephrology"],
    "blood in urine": ["Urology"],
    "blood in stool": ["Gastroenterology"],
    "jaundice": ["Gastroenterology", "Hepatology"],
    "yellow eyes": ["Hepatology"],
    "frequent urination": ["Urology", "Endocrinology"],
    "excessive thirst": ["Endocrinology", "Diabetology"],
    "fatigue": ["General Medicine", "Endocrinology"],
    "weakness": ["General Medicine", "Neurology"],
    "weight loss": ["Endocrinology", "Oncology"],
    "loss of appetite": ["General Medicine"],
    "insomnia": ["Psychiatry"],
    "anxiety": ["Psychiatry"],
    "depression": ["Psychiatry"],
    "tremor": ["Neurology"],
    "numbness": ["Neurology"],
    "tingling": ["Neurology"],
    "difficulty swallowing": ["ENT", "General Medicine"],
    "hoarse voice": ["ENT"],
    "nosebleed": ["ENT"],
    "swollen lymph": ["General Medicine", "Oncology"],
    "dehydration": ["General Medicine", "Emergency"],
    "chills": ["General Medicine"],
    "sweating": ["General Medicine"],
    "stiff neck": ["Neurology", "Orthopedics"],
    "dry mouth": ["General Medicine"],
    "night sweats": ["General Medicine", "Oncology"],
    "coughing blood": ["Pulmonology", "Emergency"],
    "cough with mucus": ["Pulmonology"],
    "wheezing": ["Pulmonology"],
    "snoring": ["ENT", "Pulmonology"],
    "cramps": ["Gynecology", "General Medicine"],
    "bleeding": ["Emergency", "Gynecology"],
}


def suggest_departments(symptoms: list[str]) -> list[str]:
    dept_scores: dict[str, float] = {}
    for symptom in symptoms:
        key = symptom.lower().strip()
        for vocab, candidates in SYMPTOM_DEPARTMENT_MAP.items():
            if vocab in key or key in vocab:
                for dept in candidates:
                    dept_scores[dept] = dept_scores.get(dept, 0.0) + 1.0
                break
    if not dept_scores:
        return ["General Medicine"]
    ranked = sorted(dept_scores.items(), key=lambda kv: -kv[1])
    top = [name for name, _ in ranked[:3]]
    return top


def score_hospital(
    hospital: object,
    distance_km: float | None,
    waiting_count: int,
    doctors_available: int,
    department_match: bool,
) -> float:
    """Weighted recommendation score: 0-100."""
    score = 50.0
    if distance_km is not None:
        score += max(-25, 25 * (1 - distance_km / 30))
    score -= min(20, waiting_count * 0.8)
    score += min(15, doctors_available * 2)
    if department_match:
        score += 12
    rating = getattr(hospital, "rating", 0) or 0
    score += rating * 2
    return round(max(0, min(100, score)), 1)


def sentiment_bias(level: str) -> np.ndarray:
    return np.zeros(len(encode_symptoms([])))
