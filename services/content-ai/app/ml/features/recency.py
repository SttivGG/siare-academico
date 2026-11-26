"""Características temporales de cantidad y recencia de intentos."""

from datetime import datetime

from app.ml.contracts import Attempt


def attempt_count(attempts: list[Attempt]) -> int:
    """Cuenta los intentos disponibles dentro de la ventana temporal seleccionada."""
    return len(attempts)


def recency_hours(attempts: list[Attempt], decision_time: datetime) -> float:
    """Calcula horas desde el último intento hasta el momento de decisión."""
    if not attempts:
        return 0.0

    latest = max(attempt.occurred_at for attempt in attempts)
    elapsed = decision_time - latest
    return max(0.0, elapsed.total_seconds() / 3600.0)
