"""Servicio independiente que transforma intentos en un resultado de riesgo.

Actualmente usa el baseline sintético. La implementación logistic puede sustituir
esta clase sin modificar autenticación ni rutas Flask.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from app.ml.baseline.error_rate import error_rate_risk
from app.ml.contracts import Attempt
from app.ml.feature_pipeline import build_topic_features
from app.ml.inference.insufficient_evidence import insufficient_evidence_response
from app.ml.training.dataset import feature_row
from app.ml.models.base import RiskModel


class LearningInferenceService:
    """Calcula recomendaciones con baseline o con un modelo ya cargado.

    El servicio no recibe datos ni instrucción para entrenar. Los modelos
    supervisados deben haberse aprobado y cargado antes de iniciar Flask.
    """

    def __init__(self, model: RiskModel | None = None):
        self.model = model

    def analyze_topic(self, topic_id: str, attempts: list[Attempt]) -> dict:
        """Calcula una respuesta por tema sin usar datos futuros al corte."""
        topic_attempts = [attempt for attempt in attempts if attempt.topic_id == topic_id]
        baseline = error_rate_risk(topic_attempts)

        if baseline["insufficientEvidence"]:
            return insufficient_evidence_response(topic_id, baseline["sampleCount"])

        if self.model is not None:
            decision_time = max(attempt.occurred_at for attempt in topic_attempts)
            features = build_topic_features(attempts, topic_id, decision_time)

            if not hasattr(self.model, "predict_risk"):
                raise RuntimeError("El modelo cargado no implementa inferencia")

            try:
                risk_row = feature_row(features)
            except (KeyError, TypeError, ValueError) as error:
                raise RuntimeError("Las características no coinciden con el modelo") from error

            risk = self.model.predict_risk(risk_row)
            return {
                "modelVersion": self.model.model_version,
                "insufficientEvidence": False,
                "riskTopics": [{
                    "topicId": topic_id,
                    "riskScore": risk,
                    "sampleCount": baseline["sampleCount"],
                }],
                "recommendations": [{
                    "topicId": topic_id,
                    "action": "PRACTICE" if risk >= 0.5 else "MAINTAIN",
                    "reason": "Riesgo calculado por el modelo supervisado cargado",
                    "predictive": True,
                }],
            }

        risk = baseline["riskScore"]
        return {
            "modelVersion": "baseline-error-rate-v1",
            "insufficientEvidence": False,
            "riskTopics": [{
                "topicId": topic_id,
                "riskScore": risk,
                "sampleCount": baseline["sampleCount"],
            }],
            "recommendations": [{
                "topicId": topic_id,
                "action": "PRACTICE" if risk >= 0.5 else "MAINTAIN",
                "reason": "Riesgo calculado por la tasa simple de errores",
                "predictive": False,
            }],
        }

    def analyze_topics(self, topic_ids: list[str], attempts: list[Attempt]) -> dict:
        """Combina resultados por tema usando hasta cuatro hilos locales de CPU."""
        if not topic_ids:
            return {
                "modelVersion": self.model.model_version if self.model is not None else "baseline-error-rate-v1",
                "insufficientEvidence": True,
                "riskTopics": [],
                "recommendations": [],
            }

        with ThreadPoolExecutor(max_workers=min(4, len(topic_ids))) as executor:
            results = list(executor.map(
                lambda topic_id: self.analyze_topic(topic_id, attempts),
                topic_ids,
            ))

        risk_topics = []
        recommendations = []
        insufficient = True

        for result in results:
            if not result["insufficientEvidence"]:
                insufficient = False
            risk_topics.extend(result["riskTopics"])
            recommendations.extend(result["recommendations"])

        return {
            "modelVersion": self.model.model_version if self.model is not None else "baseline-error-rate-v1",
            "insufficientEvidence": insufficient,
            "riskTopics": risk_topics,
            "recommendations": recommendations,
        }
