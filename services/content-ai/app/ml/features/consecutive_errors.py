"""Característica de fallos consecutivos al final de una ventana temporal."""

from app.ml.contracts import Attempt


def consecutive_errors(attempts: list[Attempt]) -> int:
    """Cuenta fallos consecutivos iniciando desde el intento más reciente."""
    count = 0
    for attempt in reversed(attempts):
        if attempt.correct:
            break
        count += 1
    return count
