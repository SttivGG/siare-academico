"""Orquesta la construcción de características por tema.

El pipeline recibe intentos validados y un instante de decisión. Cada tema usa solo
intentos ocurridos antes o en ese instante, evitando predecir con datos futuros.
"""

from datetime import datetime

from app.ml.contracts import Attempt
from app.ml.features.accuracy import accuracy_rate, normalized_score
from app.ml.features.consecutive_errors import consecutive_errors
from app.ml.features.recency import attempt_count, recency_hours
from app.ml.features.trend import recent_accuracy_trend


def build_topic_features(attempts: list[Attempt], topic_id: str,
                         decision_time: datetime) -> dict:
    """Calcula características de un tema sin incluir datos posteriores al corte."""
    topic_attempts = [
        attempt for attempt in attempts
        if attempt.topic_id == topic_id and attempt.occurred_at <= decision_time
    ]
    topic_attempts.sort(key=lambda attempt: attempt.occurred_at)

    return {
        "topicId": topic_id,
        "accuracyRate": accuracy_rate(topic_attempts),
        "normalizedScore": normalized_score(topic_attempts),
        "recentAccuracyTrend": recent_accuracy_trend(topic_attempts),
        "attemptCount": attempt_count(topic_attempts),
        "recencyHours": recency_hours(topic_attempts, decision_time),
        "consecutiveErrors": consecutive_errors(topic_attempts),
        "sampleCount": len(topic_attempts),
    }


def build_feature_rows(attempts: list[Attempt], topic_ids: list[str],
                       decision_time: datetime) -> list[dict]:
    """Construye una fila de características por cada tema solicitado."""
    if len(set(topic_ids)) != len(topic_ids):
        raise ValueError("topic_ids no puede contener temas duplicados")

    return [build_topic_features(attempts, topic_id, decision_time)
            for topic_id in topic_ids]
