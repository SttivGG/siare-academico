"""Construcción de datasets sintéticos y particiones temporales.

Las etiquetas corresponden al siguiente intento, nunca al intento incluido en las
características, evitando fuga temporal en el entrenamiento.
"""

from app.ml.contracts import Attempt


FEATURE_NAMES = [
    "accuracyRate",
    "normalizedScore",
    "recentAccuracyTrend",
    "attemptCount",
    "recencyHours",
    "consecutiveErrors",
]


def split_by_position(rows: list[dict], train_ratio: float = 0.7) -> tuple[list[dict], list[dict]]:
    """Divide filas ya ordenadas cronológicamente sin mezclar futuro y pasado."""
    if not 0.0 < train_ratio < 1.0:
        raise ValueError("train_ratio debe estar entre cero y uno")
    if len(rows) < 4:
        raise ValueError("Se requieren al menos cuatro filas")

    split_index = int(len(rows) * train_ratio)
    if split_index == 0 or split_index == len(rows):
        raise ValueError("La partición no contiene conjuntos utilizables")
    return rows[:split_index], rows[split_index:]


def feature_row(features: dict) -> list[float]:
    """Convierte una fila nombrada al vector numérico usado por el modelo."""
    return [
        float(features["accuracyRate"]),
        float(features["normalizedScore"]),
        float(features["recentAccuracyTrend"]),
        float(features["attemptCount"]),
        float(features["recencyHours"]),
        float(features["consecutiveErrors"]),
    ]


def attempts_to_topic_dataset(attempts: list[Attempt], topic_id: str) -> list[dict]:
    """Crea observaciones históricas y etiquetas futuras para un tema sintético."""
    topic_attempts = sorted(
        (attempt for attempt in attempts if attempt.topic_id == topic_id),
        key=lambda attempt: attempt.occurred_at,
    )

    rows = []
    for target_index in range(5, len(topic_attempts)):
        history = topic_attempts[:target_index]
        decision_time = history[-1].occurred_at

        accuracy = sum(attempt.correct for attempt in history) / len(history)
        normalized_score = sum(attempt.score / attempt.max_score for attempt in history) / len(history)
        midpoint = len(history) // 2
        earlier = history[:midpoint]
        recent = history[midpoint:]
        earlier_accuracy = sum(attempt.correct for attempt in earlier) / len(earlier)
        recent_accuracy = sum(attempt.correct for attempt in recent) / len(recent)

        consecutive = 0
        for attempt in reversed(history):
            if attempt.correct:
                break
            consecutive += 1

        future_attempt = topic_attempts[target_index]
        rows.append({
            "accuracyRate": accuracy,
            "normalizedScore": normalized_score,
            "recentAccuracyTrend": recent_accuracy - earlier_accuracy,
            "attemptCount": float(len(history)),
            "recencyHours": 0.0,
            "consecutiveErrors": float(consecutive),
            "label": 1 if not future_attempt.correct else 0,
        })

    return rows
