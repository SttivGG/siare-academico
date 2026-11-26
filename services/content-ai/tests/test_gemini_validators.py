"""Pruebas de validación estricta para respuestas Gemini.

Estas pruebas no llaman a Gemini ni requieren API key. Verifican que el sistema
rechace JSON malicioso, HTML, Markdown, índices inválidos y objetos incompletos.
"""

import unittest

from app.generative.validators import (
    GeminiResponseError,
    parse_json_object,
    validate_assessment,
    validate_feedback,
    validate_topic_classification,
)


class GeminiValidatorTests(unittest.TestCase):
    def test_valid_assessment_is_converted_to_model(self):
        """Acepta una evaluación mínima con índice correcto y sin formato ejecutable."""
        payload = parse_json_object('{"questions":[{"question":"¿Qué es 2+2?","options":["3","4"],"correctAnswer":1,"difficulty":"BASIC","topicId":"aritmetica"}]}')
        result = validate_assessment(payload, "00000000-0000-4000-8000-000000000501", 20)
        self.assertEqual(result.questions[0].correct_answer, 1)
        self.assertEqual(result.questions[0].difficulty, "BASIC")

    def test_invalid_json_is_rejected(self):
        """No acepta texto que no sea un objeto JSON válido."""
        with self.assertRaises(GeminiResponseError):
            parse_json_object("Esto no es JSON")

    def test_html_is_rejected(self):
        """Impide que Gemini introduzca HTML o contenido ejecutable."""
        with self.assertRaises(GeminiResponseError):
            parse_json_object('{"subject":"Matemáticas","topics":["<script>alert(1)</script>"]}')

    def test_topic_classification_is_validated(self):
        """Convierte una clasificación JSON válida a datos tipados."""
        result = validate_topic_classification({"subject":"Matemáticas", "topics": ["Fracciones"]})
        self.assertEqual(result.subject, "Matemáticas")
        self.assertEqual(result.topics, ("Fracciones",))

    def test_feedback_is_validated(self):
        """Valida mensajes, prioridades y acciones educativas permitidas."""
        result = validate_feedback({
            "message": "Puedes reforzar el tema con práctica adicional.",
            "items": [{"topicId": "fracciones", "message": "Revisa equivalencias."}],
            "recommendations": [{"topicId": "fracciones", "priority": 1,
                                  "action": "PRACTICE_TOPIC", "reasonCode": "LOW_MASTERY"}],
        })
        self.assertEqual(result.recommendations[0].action, "PRACTICE_TOPIC")

    def test_correct_answer_must_be_in_range(self):
        """Rechaza índices que no correspondan a una opción existente."""
        payload = {"questions": [{"question": "Una pregunta", "options": ["A", "B"],
                                   "correctAnswer": 3, "difficulty": "BASIC", "topicId": "tema"}]}
        with self.assertRaises(GeminiResponseError):
            validate_assessment(payload, "00000000-0000-4000-8000-000000000501", 20)


if __name__ == "__main__":
    unittest.main()
