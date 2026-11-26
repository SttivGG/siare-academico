"""Pruebas deterministas del conteo y consistencia de evaluaciones Gemini."""

import unittest

from app.generative.validators import GeminiResponseError, validate_assessment


class GeminiAssessmentConsistencyTests(unittest.TestCase):
    def test_exact_count_is_accepted(self):
        """Una evaluación con el número solicitado conserva clave y opciones."""
        payload = {"questions": [{
            "question": "¿Qué operador filtra documentos?",
            "options": ["$match", "$sort"],
            "correctAnswer": 0,
            "difficulty": "BASIC",
            "topicId": "mongodb-aggregate",
        }, {
            "question": "¿Qué operador agrupa documentos?",
            "options": ["$group", "$limit"],
            "correctAnswer": 0,
            "difficulty": "BASIC",
            "topicId": "mongodb-aggregate",
        }]}
        result = validate_assessment(payload, "00000000-0000-4000-8000-000000000701", 2)
        self.assertEqual(len(result.questions), 2)
        self.assertEqual(result.questions[0].correct_answer, 0)

    def test_duplicate_options_are_rejected(self):
        """Dos opciones iguales no pueden producir una clave ambigua."""
        payload = {"questions": [{
            "question": "¿Qué operador cuenta?",
            "options": ["$sum", "$sum"],
            "correctAnswer": 0,
            "difficulty": "BASIC",
            "topicId": "mongodb-aggregate",
        }]}
        with self.assertRaises(GeminiResponseError):
            validate_assessment(payload, "00000000-0000-4000-8000-000000000702", 1)


if __name__ == "__main__":
    unittest.main()
