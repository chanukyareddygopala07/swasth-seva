import joblib
import numpy as np
import pandas as pd

from app.ai.features import SYMPTOM_VOCAB
from app.ai.models import CrowdModel, NoShowModel, WaitingTimeModel, WorkloadModel
from app.ai.models import TriageModel

POSITIVE_WORDS = [
    "excellent", "great", "amazing", "good", "helpful", "kind", "friendly", "fast", "quick",
    "clean", "care", "caring", "professional", "recommend", "love", "best", "smooth", "on time",
    "satisfied", "happy", "grateful", "thank", "responsive",
]
NEGATIVE_WORDS = [
    "bad", "terrible", "awful", "poor", "rude", "slow", "dirty", "unprofessional", "worst",
    "hate", "long wait", "waiting", "unhelpful", "negligent", "careless", "error", "mistake",
    "expensive", "overcharged", "crowded", "ignored", "late", "disappointed", "frustrated",
]


class SentimentModel:
    name = "sentiment"

    def __init__(self) -> None:
        from app.config import settings
        import os

        self.path = os.path.join(settings.AI_MODEL_DIR, f"{self.name}.joblib")
        self.model = None
        self._load()

    def _load(self) -> None:
        try:
            if self.path:
                self.model = joblib.load(self.path)
        except Exception:
            self.model = None

    def predict(self, text: str) -> dict:
        if not text or not text.strip():
            return {"sentiment": "neutral", "score": 0.5, "confidence": 0.5, "model": "lexicon"}
        lowered = text.lower()
        if self.model is not None:
            try:
                from sklearn.feature_extraction.text import TfidfVectorizer

                vec = self.model.get("vectorizer")
                clf = self.model.get("classifier")
                X = vec.transform([text])
                label = clf.predict(X)[0]
                proba = clf.predict_proba(X)[0] if hasattr(clf, "predict_proba") else None
                score = float(proba[list(clf.classes_).index(label)]) if proba is not None else 0.7
                return {"sentiment": str(label), "score": round(score, 3), "confidence": round(score, 3), "model": "tfidf_sgd"}
            except Exception:
                pass
        pos = sum(1 for w in POSITIVE_WORDS if w in lowered)
        neg = sum(1 for w in NEGATIVE_WORDS if w in lowered)
        total = pos + neg
        if total == 0:
            return {"sentiment": "neutral", "score": 0.5, "confidence": 0.4, "model": "lexicon"}
        score = pos / total
        sentiment = "positive" if score > 0.6 else ("negative" if score < 0.4 else "neutral")
        return {"sentiment": sentiment, "score": round(score, 3), "confidence": round(abs(score - 0.5) * 2, 3), "model": "lexicon"}


sentiment_model = SentimentModel()


def train_all() -> None:
    """Fit and persist all models on curated + synthetic datasets."""
    rng = np.random.default_rng(42)

    # Waiting time: Random Forest
    n = 4000
    queue_size = rng.integers(0, 60, n)
    consultation = rng.integers(5, 25, n)
    emergency = rng.integers(0, 5, n)
    hour = rng.integers(0, 24, n)
    day = rng.integers(0, 7, n)
    doctors = rng.integers(1, 4, n)
    noise = rng.normal(0, 8, n)
    wait = (queue_size * consultation * 0.55 + emergency * consultation * 1.1 + hour_features_penalty(hour) + noise)
    wait = np.clip(wait, 0, 240)
    X = pd.DataFrame(
        {"queue_size": queue_size, "consultation": consultation, "emergency": emergency, "hour": hour, "day": day, "doctors": doctors}
    )
    from sklearn.ensemble import RandomForestRegressor

    rf = RandomForestRegressor(n_estimators=120, max_depth=12, random_state=42, n_jobs=-1)
    rf.fit(X, wait)
    WaitingTimeModel().save(rf)

    # Triage: Random Forest classifier
    triage_samples = []
    triage_labels = []
    for i, symptom in enumerate(SYMPTOM_VOCAB):
        base = np.zeros(len(SYMPTOM_VOCAB))
        base[i] = 1
        for _ in range(25):
            perturbed = np.clip(base + rng.choice([0, 1], len(SYMPTOM_VOCAB), p=[0.9, 0.1]), 0, 1)
            triage_samples.append(perturbed)
            if symptom in TriageModel.RED_WORDS:
                label = 3
            elif symptom in TriageModel.ORANGE_WORDS:
                label = 2
            elif symptom in TriageModel.YELLOW_WORDS:
                label = 1
            else:
                label = 0
            triage_labels.append(label)
    X_t = np.array(triage_samples)
    y_t = np.array(triage_labels)
    from sklearn.ensemble import RandomForestClassifier

    tc = RandomForestClassifier(n_estimators=150, random_state=42, n_jobs=-1)
    tc.fit(X_t, y_t)
    TriageModel().save(tc)

    # No-show: XGBoost
    from xgboost import XGBClassifier

    n = 3000
    age = rng.integers(1, 90, n)
    dow = rng.integers(0, 7, n)
    hr = rng.integers(8, 20, n)
    dist = rng.uniform(0, 50, n)
    prior = rng.integers(0, 5, n)
    prob = 0.1 + 0.05 * (dow >= 5) + 0.08 * ((hr < 9) | (hr > 18)) + 0.008 * dist + 0.06 * prior
    label = (rng.uniform(0, 1, n) < prob).astype(int)
    X_n = pd.DataFrame({"age": age, "dow": dow, "hour": hr, "dist": dist, "prior": prior})
    xgb = XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42, eval_metric="logloss")
    xgb.fit(X_n, label)
    NoShowModel().save(xgb)

    # Crowd: trend model baked into CrowdModel via refit; persist a base model
    history_hours = np.arange(0, 24)
    history_counts = 10 + 25 * np.exp(-((history_hours - 11) ** 2) / 18) + rng.normal(0, 3, 24)
    CrowdModel().save({"base": float(history_counts.max())})

    # Workload
    n = 3000
    appts = rng.integers(0, 40, n)
    consult = rng.integers(5, 25, n)
    cap = np.maximum(4, (8 * 60) // consult)
    workload = np.clip(appts + 1.5 * ((hr % 12) < 3), 0, cap)
    X_w = pd.DataFrame({"appts": appts, "consult": consult, "dow": rng.integers(0, 7, n), "hour": rng.integers(8, 20, n)})
    from sklearn.ensemble import RandomForestRegressor

    wr = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    wr.fit(X_w, workload)
    WorkloadModel().save(wr)

    # Sentiment: TF-IDF + SGD
    pos = [
        "Excellent service, very caring staff", "Doctor was very professional and helpful",
        "Great experience, quick and clean", "Very friendly staff, highly recommend",
        "Best hospital visit I ever had", "The nurse was kind and attentive",
        "Fast queue, on time consultation", "Very satisfied with the treatment",
        "Amazing care, thank you", "Clean rooms and polite doctors",
    ]
    neg = [
        "Terrible experience, long wait", "Rude staff, very unprofessional",
        "Poor service, doctor was careless", "Worst hospital, avoid",
        "I waited for hours, frustrating", "Dirty and crowded",
        "Doctor made an error in prescription", "Very disappointed with care",
        "Unhelpful receptionist, ignored me", "Overcharged for treatment",
    ]
    neutral = [
        "Average experience overall", "It was okay", "Nothing special",
        "Standard consultation", "The queue was normal",
    ]
    texts = pos + neg + neutral
    labels = ["positive"] * len(pos) + ["negative"] * len(neg) + ["neutral"] * len(neutral)
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import SGDClassifier

    vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    X_s = vec.fit_transform(texts)
    sgd = SGDClassifier(random_state=42, loss="modified_huber")
    sgd.fit(X_s, labels)
    import joblib as _jl

    _jl.dump({"vectorizer": vec, "classifier": sgd}, SentimentModel().path)

    print("All AI models trained and persisted.")


def hour_features_penalty(hour: np.ndarray) -> np.ndarray:
    return np.where((hour >= 13) & (hour <= 14), -5, 0)
