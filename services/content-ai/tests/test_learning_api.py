"""Pruebas HTTP del endpoint interno de aprendizaje adaptativo.

Estas pruebas cubren:
- Compatibilidad temporal del contrato anterior.
- Contrato aprobado v1 con observaciones normalizadas.
- Evidencia insuficiente.
- Autenticación por credencial interna.
- Límites y rechazo de versiones incompatibles.
"""

import unittest

from app import create_app
from app.models.health import HealthModel


class LearningApiTests(unittest.TestCase):
    def setUp(self):
        app = create_app(HealthModel({"mongo": lambda: True, "redis": lambda: True}))
        app.config.update(TESTING=True,
                          LEARNING_SERVICE_TOKEN="a" * 32,
                          LEARNING_MAX_BYTES=1048576)
        self.client = app.test_client()
        self.headers = {
            "Authorization": "Bearer " + "a" * 32,
            "X-Request-Id": "00000000-0000-4000-8000-000000000401",
        }

    def payload(self):
        """Construye una carga sintética para probar el contrato anterior."""
        attempts = []
        for index in range(1, 6):
            attempts.append({
                "activityId": f"00000000-0000-4000-8000-{index:012d}",
                "topicId": "fracciones",
                "correct": index % 2 == 0,
                "score": 4 if index % 2 == 0 else 1,
                "maxScore": 5,
                "occurredAt": f"2026-11-{index:02d}T10:30:00Z",
            })
        return {
            "requestId": "00000000-0000-4000-8000-000000000401",
            "userId": "00000000-0000-4000-8000-000000000402",
            "subjectId": "00000000-0000-4000-8000-000000000403",
            "attempts": attempts,
        }

    def test_authorization_and_success_contract(self):
        response = self.client.post("/internal/v1/learning/analyze",
                                    json=self.payload(), headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json["insufficientEvidence"])
        self.assertEqual(response.json["requestId"], self.payload()["requestId"])
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_missing_auth_is_rejected(self):
        response = self.client.post("/internal/v1/learning/analyze",
                                    json=self.payload())
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json["errorCode"], "UNAUTHORIZED")

    def test_too_many_attempts_is_rejected(self):
        payload = self.payload()
        payload["attempts"] = payload["attempts"] * 201
        response = self.client.post("/internal/v1/learning/analyze",
                                    json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["errorCode"], "INVALID_REQUEST")

    def test_v1_contract_success(self):
        """Prueba que el contrato v1 es exitoso con datos válidos."""
        observations = []
        for index in range(1, 6):
            observations.append({
                "attemptId": f"00000000-0000-4000-8000-{index:012d}",
                "topicId": "fracciones",
                "score": 0.8 if index % 2 == 0 else 0.2,
                "durationMs": 45000,
                "occurredAt": f"2026-11-{index:02d}T10:30:00Z",
            })
        payload = {
            "schemaVersion": 1,
            "requestId": "00000000-0000-4000-8000-000000000401",
            "studentId": "00000000-0000-4000-8000-000000000402",
            "subjectId": "00000000-0000-4000-8000-000000000403",
            "modelVersion": "baseline-error-rate-v1",
            "observations": observations,
            "maxRecommendations": 3,
        }

        response = self.client.post("/internal/v1/learning/analyses",
                                    json=payload, headers=self.headers)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json["insufficientEvidence"])
        self.assertEqual(response.json["requestId"], payload["requestId"])
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(response.json["difficulties"][0]["topicId"], "fracciones")

    def test_v1_insufficient_evidence(self):
        """Prueba que el sistema identifica evidencia insuficiente."""
        payload = {
            "schemaVersion": 1,
            "requestId": "00000000-0000-4000-8000-000000000401",
            "studentId": "00000000-0000-4000-8000-000000000402",
            "subjectId": "00000000-0000-4000-8000-000000000403",
            "modelVersion": "baseline-error-rate-v1",
            "observations": [{
                "attemptId": "00000000-0000-4000-8000-000000000404",
                "topicId": "fracciones",
                "score": 0.4,
                "durationMs": 45000,
                "occurredAt": "2026-11-18T18:00:00Z",
            }],
            "maxRecommendations": 3,
        }

        response = self.client.post("/internal/v1/learning/analyses",
                                    json=payload, headers=self.headers)

        self.assertIn(response.status_code, (200, 422))
        self.assertTrue(response.json["insufficientEvidence"])

    def test_v1_rejects_invalid_schema(self):
        """Prueba que el sistema rechaza esquemas no soportados."""
        payload = {
            "schemaVersion": 2,
            "requestId": "00000000-0000-4000-8000-000000000401",
            "studentId": "00000000-0000-4000-8000-000000000402",
            "subjectId": "00000000-0000-4000-8000-000000000403",
            "modelVersion": "adaptive-v1",
            "observations": [],
            "maxRecommendations": 3,
        }

        response = self.client.post("/internal/v1/learning/analyses",
                                    json=payload, headers=self.headers)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["errorCode"], "UNSUPPORTED_SCHEMA_VERSION")

    def test_v1_model_unavailable_is_rejected(self):
        """No admite predicciones ni percentiles con una versión no cargada."""
        payload = {
            "schemaVersion": 1,
            "requestId": "00000000-0000-4000-8000-000000000401",
            "studentId": "00000000-0000-4000-8000-000000000402",
            "subjectId": "00000000-0000-4000-8000-000000000403",
            "modelVersion": "adaptive-logistic-v1",
            "observations": [{
                "attemptId": "00000000-0000-4000-8000-000000000404",
                "topicId": "fracciones",
                "score": 0.4,
                "durationMs": 45000,
                "occurredAt": "2026-11-18T18:00:00Z",
            }],
            "maxRecommendations": 3,
        }

        response = self.client.post("/internal/v1/learning/analyses",
                                    json=payload, headers=self.headers)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["errorCode"], "MODEL_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
