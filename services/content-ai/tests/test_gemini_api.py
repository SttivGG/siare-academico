"""Pruebas HTTP con Gemini mockeado, sin clave ni llamadas externas.

Los endpoints verifican autenticación, límites, JSON generado y compatibilidad
con la arquitectura Flask existente. El mock reemplaza generate_json.
"""

import unittest
from unittest.mock import patch

from app import create_app
from app.models.health import HealthModel
from app.generative.fallback_assessment import build_fallback_assessment


class GeminiApiTests(unittest.TestCase):
    def setUp(self):
        app = create_app(HealthModel({"mongo": lambda: True, "redis": lambda: True}))
        app.config.update(
            TESTING=True,
            LEARNING_SERVICE_TOKEN="a" * 32,
            GEMINI_MAX_REQUEST_BYTES=131072,
            GEMINI_MAX_INPUT_CHARS=100000,
            GEMINI_MAX_QUESTIONS=20,
        )
        self.client = app.test_client()
        self.headers = {
            "Authorization": "Bearer " + "a" * 32,
            "X-Request-Id": "00000000-0000-4000-8000-000000000601",
        }

        class MockGemini:
            model = "gemini-test"

            def generate_json(self, prompt):
                if "Clasifica el siguiente contenido" in prompt:
                    return '{"subject":"Matemáticas","topics":["Fracciones"]}'
                if "retroalimentación educativa" in prompt:
                    return '{"message":"Revisa el tema con práctica guiada.","items":[{"topicId":"fracciones","message":"Practica equivalencias."}],"recommendations":[{"topicId":"fracciones","priority":1,"action":"PRACTICE_TOPIC","reasonCode":"LOW_MASTERY"}]}'
                return '{"questions":[{"question":"¿Cuánto es 1/2 + 1/2?","options":["1/4","1"],"correctAnswer":1,"difficulty":"BASIC","topicId":"fracciones"}]}'

        app.extensions["gemini_service"] = MockGemini()

    def test_classify_topics(self):
        """Prueba clasificación temática usando Gemini reemplazado por mock."""
        response = self.client.post("/internal/v1/learning/classify-topics", json={
            "requestId": "00000000-0000-4000-8000-000000000601",
            "subjectId": "00000000-0000-4000-8000-000000000602",
            "documentId": "00000000-0000-4000-8000-000000000603",
            "content": "Las fracciones representan partes de una unidad.",
        }, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["topics"], ["Fracciones"])

    def test_generate_assessment(self):
        """Prueba generación de evaluación estructurada con mock."""
        response = self.client.post("/internal/v1/learning/generate-assessment", json={
            "requestId": "00000000-0000-4000-8000-000000000601",
            "subjectId": "00000000-0000-4000-8000-000000000602",
            "documentId": "00000000-0000-4000-8000-000000000603",
            "topic": "Fracciones",
            "content": "Las fracciones representan partes de una unidad.",
            "questionCount": 1,
        }, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json["questions"]), 1)

    def test_generate_feedback(self):
        """Prueba retroalimentación educativa sin llamadas externas."""
        response = self.client.post("/internal/v1/learning/generate-feedback", json={
            "requestId": "00000000-0000-4000-8000-000000000601",
            "studentId": "00000000-0000-4000-8000-000000000602",
            "subjectId": "00000000-0000-4000-8000-000000000603",
            "performance": {"averageScore": 0.4},
            "dominatedTopics": ["numeros"],
            "weakTopics": ["fracciones"],
        }, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["recommendations"][0]["action"], "PRACTICE_TOPIC")

    def test_missing_auth_is_rejected(self):
        """Un endpoint Gemini nunca acepta una solicitud sin secreto interno."""
        response = self.client.post("/internal/v1/learning/generate-assessment", json={
            "requestId": "00000000-0000-4000-8000-000000000601",
            "subjectId": "00000000-0000-4000-8000-000000000602",
            "documentId": "00000000-0000-4000-8000-000000000603",
            "content": "Contenido sintético.",
            "questionCount": 1,
        })
        self.assertEqual(response.status_code, 401)

    def test_empty_gemini_response_uses_safe_fallback(self):
        """Una falla Gemini usa una evaluación local válida, sin 400 ni 503."""
        from app.generative.gemini_service import GeminiUnavailableError

        class FailingGemini:
            model = "gemini-test"

            def generate_json(self, prompt):
                raise GeminiUnavailableError("EMPTY_RESPONSE")

        self.client.application.extensions["gemini_service"] = FailingGemini()
        response = self.client.post("/internal/v1/learning/generate-assessment", json={
            "requestId": "00000000-0000-4000-8000-000000000601",
            "subjectId": "00000000-0000-4000-8000-000000000602",
            "documentId": "00000000-0000-4000-8000-000000000603",
            "topic": "MongoDB Aggregate",
            "content": "MongoDB match filtra, group agrupa, sort ordena y limit conserva resultados.",
            "questionCount": 3,
        }, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["model"], "fallback-document-v1")
        self.assertEqual(len(response.json["questions"]), 3)


if __name__ == "__main__":
    unittest.main()
