"""Baseline simple de riesgo basado en la proporción de errores.

Esta regla no es Machine Learning supervisado. Sirve para determinar si el modelo
real aporta valor adicional y como degradación transparente con pocos datos.
"""

from app.ml.contracts import Attempt


MINIMUM_BASELINE_SAMPLES = 5


def error_rate_risk(attempts: list[Attempt]) -> dict:
    """Calcula riesgo por tasa de errores o declara evidencia insuficiente."""
    if len(attempts) < MINIMUM_BASELINE_SAMPLES:
        return {
            "riskScore": None,
            "insufficientEvidence": True,
            "reason": "Se requieren al menos cinco intentos",
            "sampleCount": len(attempts),
        }

    error_count = sum(1 for attempt in attempts if not attempt.correct)
    return {
        "riskScore": round(error_count / len(attempts), 6),
        "insufficientEvidence": False,
        "reason": None,
        "sampleCount": len(attempts),
    }
