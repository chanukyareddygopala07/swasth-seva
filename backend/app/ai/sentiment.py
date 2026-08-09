import os

import joblib

from app.config import settings

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
        self.path = os.path.join(settings.AI_MODEL_DIR, f"{self.name}.joblib")
        self.model = None
        self._load()

    def _load(self) -> None:
        try:
            self.model = joblib.load(self.path)
        except Exception:
            self.model = None

    def predict(self, text: str) -> dict:
        if not text or not text.strip():
            return {"sentiment": "neutral", "score": 0.5, "confidence": 0.5, "model": "lexicon"}
        lowered = text.lower()
        if self.model is not None:
            try:
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
