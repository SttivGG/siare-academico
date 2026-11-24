"""Característica temporal que compara rendimiento reciente con rendimiento previo."""

from app.ml.contracts import Attempt


def recent_accuracy_trend(attempts: list[Attempt]) -> float:
    """Devuelve diferencia de precisión entre mitad reciente y mitad anterior.

    El rango de salida está aproximadamente entre -1 y 1. No usa datos posteriores
    al corte si el pipeline recibe correctamente los intentos históricos.
    """
    if len(attempts) < 2:
        return 0.0

    midpoint = len(attempts) // 2
    earlier = attempts[:midpoint]
    recent = attempts[midpoint:]
    earlier_accuracy = sum(attempt.correct for attempt in earlier) / len(earlier)
    recent_accuracy = sum(attempt.correct for attempt in recent) / len(recent)
    return recent_accuracy - earlier_accuracy
