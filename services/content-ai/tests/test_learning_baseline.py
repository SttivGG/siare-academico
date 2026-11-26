"""Pruebas del baseline simple de tasa de errores."""

import unittest

from app.ml.baseline.error_rate import error_rate_risk
from app.ml.contracts import parse_attempts


class LearningBaselineTests(unittest.TestCase):
    def test_insufficient_evidence_is_not_predicted(self):
        """Menos de cinco intentos activa abstención, no una probabilidad inventada."""
        attempts = parse_attempts([
            {"activityId": "00000000-0000-4000-8000-000000000301", "topicId": "fracciones", "correct": False, "score": 1, "maxScore": 5, "occurredAt": "2026-10-01T09:00:00Z"},
            {"activityId": "00000000-0000-4000-8000-000000000302", "topicId": "fracciones", "correct": False, "score": 1, "maxScore": 5, "occurredAt": "2026-10-02T09:00:00Z"},
        ])

        result = error_rate_risk(attempts)
        self.assertTrue(result["insufficientEvidence"])
        self.assertIsNone(result["riskScore"])

    def test_error_rate_is_calculated(self):
        """Cinco fallos producen riesgo 1.0 dentro de la ventana sintética."""
        attempts = parse_attempts([
            {"activityId": f"00000000-0000-4000-8000-{index:012d}", "topicId": "fracciones", "correct": False, "score": 1, "maxScore": 5, "occurredAt": f"2026-10-{index:02d}T09:00:00Z"}
            for index in range(1, 6)
        ])

        result = error_rate_risk(attempts)
        self.assertFalse(result["insufficientEvidence"])
        self.assertEqual(result["riskScore"], 1.0)
        self.assertEqual(result["sampleCount"], 5)


if __name__ == "__main__":
    unittest.main()
