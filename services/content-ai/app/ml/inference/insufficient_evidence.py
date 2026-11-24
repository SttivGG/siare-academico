"""Respuesta no predictiva cuando no existe evidencia suficiente."""

from app.ml.baseline.error_rate import MINIMUM_BASELINE_SAMPLES


def insufficient_evidence_response(topic_id: str, sample_count: int) -> dict:
    """Explica la abstención sin inventar una probabilidad de riesgo."""
    return {
        "modelVersion": "none",
        "insufficientEvidence": True,
        "riskTopics": [],
        "recommendations": [{
            "topicId": topic_id,
            "action": "REVIEW",
            "reason": f"Se requieren al menos {MINIMUM_BASELINE_SAMPLES} intentos; solo se recibieron {sample_count}.",
            "predictive": False,
        }],
    }
