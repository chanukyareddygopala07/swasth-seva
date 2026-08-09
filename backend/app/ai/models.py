import os
from typing import Any, Optional

import joblib
import numpy as np

from app.config import settings
from app.ai.features import SYMPTOM_VOCAB, encode_symptoms, hour_features


class BaseModel:
    name: str = ""

    def model_path(self) -> str:
        return os.path.join(settings.AI_MODEL_DIR, f"{self.name}.joblib")

    def load(self) -> Any | None:
        path = self.model_path()
        if os.path.exists(path):
            try:
                return joblib.load(path)
            except Exception:
                return None
        return None

    def save(self, model: Any) -> None:
        os.makedirs(settings.AI_MODEL_DIR, exist_ok=True)
        joblib.dump(model, self.model_path())


class WaitingTimeModel(BaseModel):
    """Random Forest regression over queue dynamics + time features."""

    name = "waiting_time"

    def predict(self, queue_size: int, avg_consultation_minutes: int, emergency_count: int, hour: int, day_of_week: int, doctors_count: int = 1) -> dict[str, Any]:
        model = self.load()
        features = np.array(
            [
                queue_size,
                avg_consultation_minutes,
                emergency_count,
                max(1, doctors_count),
                hour,
                day_of_week,
            ]
        ).reshape(1, -1)
        if model is not None:
            try:
                minutes = float(model.predict(features)[0])
                confidence = 0.88
            except Exception:
                minutes, confidence = self._heuristic(queue_size, avg_consultation_minutes, emergency_count, hour)
        else:
            minutes, confidence = self._heuristic(queue_size, avg_consultation_minutes, emergency_count, hour)
        minutes = max(0, round(minutes))
        return {
            "predicted_wait_minutes": minutes,
            "confidence": confidence,
            "factors": {
                "queue_size": queue_size,
                "avg_consultation_minutes": avg_consultation_minutes,
                "emergency_count": emergency_count,
                "hour": hour,
                "day_of_week": day_of_week,
            },
            "model": "random_forest" if model is not None else "heuristic",
        }

    @staticmethod
    def _heuristic(queue_size: int, avg_consultation: int, emergency_count: int, hour: int) -> tuple[float, float]:
        base = max(0, queue_size) * max(1, avg_consultation)
        emergency_penalty = emergency_count * max(1, avg_consultation) * 0.8
        lunch_dip = 0.85 if 13 <= hour <= 14 else 1.0
        minutes = (base + emergency_penalty) * lunch_dip * 0.75
        return minutes, 0.72


class TriageModel(BaseModel):
    """Random Forest classifier → green / yellow / orange / red."""

    name = "triage"

    RED_WORDS = ["unconsciousness", "fainting", "seizure", "chest pain", "breathing difficulty", "shortness of breath", "coughing blood", "bleeding", "high blood pressure"]
    ORANGE_WORDS = ["vomiting", "blood in urine", "blood in stool", "confusion", "dehydration", "fracture", "burn", "severe abdominal pain", "stomach pain"]
    YELLOW_WORDS = ["fever", "dizziness", "rash", "burning urination", "jaundice", "yellow eyes", "headache", "migraine"]

    def predict(self, symptoms: list[str], age: Optional[int] = None, vitals: dict | None = None) -> dict[str, Any]:
        model = self.load()
        vec = encode_symptoms(symptoms).reshape(1, -1)
        if model is not None:
            try:
                level_idx = int(model.predict(vec)[0])
                probs = model.predict_proba(vec)[0] if hasattr(model, "predict_proba") else None
                score = float(probs[level_idx]) if probs is not None else 0.75
                level = ["green", "yellow", "orange", "red"][level_idx]
                return {"level": level, "score": round(score, 2), "model": "random_forest"}
            except Exception:
                pass
        return self._heuristic(symptoms, age, vitals or {})

    @staticmethod
    def _heuristic(symptoms: list[str], age: Optional[int], vitals: dict) -> dict[str, Any]:
        lowered = " ".join(s.lower() for s in symptoms)
        urgency = 0.0
        for word in TriageModel.RED_WORDS:
            if word in lowered:
                urgency += 1.0
        for word in TriageModel.ORANGE_WORDS:
            if word in lowered:
                urgency += 0.7
        for word in TriageModel.YELLOW_WORDS:
            if word in lowered:
                urgency += 0.4
        if vitals:
            temp = float(vitals.get("temperature", 0) or 0)
            if temp >= 103:
                urgency += 0.8
            elif temp >= 101:
                urgency += 0.4
            pulse = float(vitals.get("pulse", 0) or 0)
            if pulse and (pulse > 120 or pulse < 50):
                urgency += 0.8
            spo2 = float(vitals.get("spo2", 0) or 0)
            if spo2 and spo2 < 90:
                urgency += 1.0
        if age is not None and age >= 65:
            urgency += 0.3
        if age is not None and age <= 2:
            urgency += 0.3
        urgency = min(2.4, urgency)
        if urgency >= 1.8:
            level = "red"
        elif urgency >= 1.1:
            level = "orange"
        elif urgency >= 0.5:
            level = "yellow"
        else:
            level = "green"
        return {"level": level, "score": round(0.5 + urgency / 4.8, 2), "model": "heuristic"}


class CrowdModel(BaseModel):
    """Predict next N hours of occupancy using linear trend + seasonality."""

    name = "crowd"

    def predict(self, hospital_id: str, history: list[tuple[int, int]], current: int) -> list[dict[str, Any]]:
        model = self.load()
        predictions = []
        if model is not None and len(history) >= 4:
            try:
                X = np.array([[h, h * h] for h, _ in history], dtype=float)
                y = np.array([v for _, v in history], dtype=float)
                model.fit(X, y)
                base = int(model.predict([[24, 576]])[0])
            except Exception:
                base = None
        else:
            base = None
        import datetime as dt

        now = dt.datetime.now()
        for offset in range(1, 7):
            hour = (now.hour + offset) % 24
            pattern = 1.0 if 9 <= hour <= 13 else (0.7 if 16 <= hour <= 20 else 0.45)
            if base is not None:
                value = max(0, int(base * pattern))
            else:
                value = max(0, int((current * 0.9 + 15) * pattern * (1 + 0.1 * np.sin(offset))))
            predictions.append({"hour": f"{now.hour + offset:02d}:00", "expected_occupancy": value})
        return predictions


class NoShowModel(BaseModel):
    """Predict appointment no-show probability."""

    name = "no_show"

    def predict(self, age: int, day_of_week: int, hour: int, distance_km: float, prior_no_shows: int) -> dict[str, Any]:
        model = self.load()
        X = np.array([age, day_of_week, hour, distance_km, prior_no_shows]).reshape(1, -1)
        if model is not None:
            try:
                prob = float(model.predict_proba(X)[0][1]) if hasattr(model, "predict_proba") else float(model.predict(X)[0])
            except Exception:
                prob = self._heuristic(day_of_week, hour, distance_km, prior_no_shows)
        else:
            prob = self._heuristic(day_of_week, hour, distance_km, prior_no_shows)
        prob = float(np.clip(prob, 0.0, 1.0))
        risk = "low" if prob < 0.3 else ("medium" if prob < 0.6 else "high")
        return {
            "probability": round(prob, 3),
            "risk": risk,
            "recommendation": {
                "low": "Patient very likely to attend. No action needed.",
                "medium": "Send a reminder 12 hours before the appointment.",
                "high": "Send reminder + offer reschedule; consider double-booking a follow-up slot.",
            }[risk],
            "model": "xgboost" if model is not None else "heuristic",
        }

    @staticmethod
    def _heuristic(day_of_week: int, hour: int, distance_km: float, prior_no_shows: int) -> float:
        prob = 0.12
        prob += 0.08 if day_of_week >= 5 else 0.0
        prob += 0.10 if hour < 9 else (0.05 if hour > 18 else 0.0)
        prob += min(0.3, distance_km / 60)
        prob += min(0.3, prior_no_shows * 0.08)
        return min(0.9, prob)


class WorkloadModel(BaseModel):
    """Predict doctor's expected patient load."""

    name = "workload"

    def predict(self, appointments_today: int, avg_consultation: int, day_of_week: int, hour: int) -> dict[str, Any]:
        model = self.load()
        X = np.array([appointments_today, avg_consultation, day_of_week, hour]).reshape(1, -1)
        if model is not None:
            try:
                predicted = float(model.predict(X)[0])
            except Exception:
                predicted = None
        else:
            predicted = None
        if predicted is None:
            cap = max(4, int((8 * 60) / max(5, avg_consultation)))
            predicted = min(cap, appointments_today + (1 if 9 <= hour <= 11 else 0))
        load_pct = min(100.0, predicted / max(4, int((8 * 60) / max(5, avg_consultation))) * 100)
        status = "overloaded" if load_pct >= 90 else ("busy" if load_pct >= 60 else "normal")
        return {
            "predicted_patients": int(predicted),
            "load_percent": round(load_pct, 1),
            "status": status,
            "recommendation": {
                "overloaded": "Consider extending hours or assigning an extra doctor.",
                "busy": "Peak load expected; keep the queue flowing.",
                "normal": "Load is manageable.",
            }[status],
            "model": "random_forest" if model is not None else "heuristic",
        }


waiting_time_model = WaitingTimeModel()
triage_model = TriageModel()
crowd_model = CrowdModel()
no_show_model = NoShowModel()
workload_model = WorkloadModel()


def predict_wait_time(**kwargs) -> dict[str, Any]:
    return waiting_time_model.predict(**kwargs)


def predict_triage(symptoms: list[str], age: Optional[int] = None, vitals: dict | None = None) -> dict[str, Any]:
    return triage_model.predict(symptoms, age, vitals)
