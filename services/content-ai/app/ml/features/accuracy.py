"""Características de precisión y puntaje normalizado."""

from app.ml.contracts import Attempt


def accuracy_rate(attempts: list[Attempt]) -> float:
    """Devuelve la proporción de intentos correctos dentro de la ventana seleccionada."""
    if not attempts:
        return 0.0
    return sum(attempt.correct for attempt in attempts) / len(attempts)


def normalized_score(attempts: list[Attempt]) -> float:
    """Promedia puntajes normalizados entre cero y uno para compararlos entre actividades."""
    if not attempts:
        return 0.0
    return sum(attempt.score / attempt.max_score for attempt in attempts) / len(attempts)
