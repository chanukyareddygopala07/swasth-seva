import numpy as np

SYMPTOM_VOCAB = [
    "fever", "cough", "cold", "headache", "chest pain", "breathing difficulty", "shortness of breath",
    "dizziness", "fatigue", "nausea", "vomiting", "diarrhea", "abdominal pain", "stomach pain",
    "joint pain", "back pain", "rash", "sore throat", "runny nose", "body ache", "weakness",
    "palpitations", "high blood pressure", "swelling", "bleeding", "fainting", "unconsciousness",
    "seizure", "confusion", "dehydration", "weight loss", "loss of appetite", "insomnia",
    "anxiety", "depression", "burning urination", "blood in urine", "blood in stool", "yellow eyes",
    "blurred vision", "ear pain", "tooth pain", "wound", "fracture", "burn", "allergy",
    "itchy skin", "migraine", "heartburn", "constipation", "cramps", "jaundice", "chills",
    "sweating", "difficulty swallowing", "hoarse voice", "nosebleed", "eye redness", "swollen lymph",
    "numbness", "tingling", "tremor", "stiff neck", "hair loss", "dry mouth", "frequent urination",
    "excessive thirst", "night sweats", "coughing blood", "cough with mucus", "wheezing", "snoring",
]


def encode_symptoms(symptoms: list[str]) -> np.ndarray:
    text = " ".join(s.lower() for s in symptoms)
    vec = np.zeros(len(SYMPTOM_VOCAB))
    for i, word in enumerate(SYMPTOM_VOCAB):
        for token in text.split():
            if word in token or token in word:
                vec[i] = 1.0
                break
    return vec


def encode_text(text: str, vocab: list[str]) -> np.ndarray:
    words = set(text.lower().split())
    return np.array([1.0 if w in words else 0.0 for w in vocab])


def hour_features(hour: int, day_of_week: int) -> np.ndarray:
    return np.array(
        [
            np.sin(2 * np.pi * hour / 24),
            np.cos(2 * np.pi * hour / 24),
            day_of_week / 6.0,
            1.0 if hour in (9, 10, 11) else 0.0,
            1.0 if hour in (16, 17, 18) else 0.0,
        ]
    )
