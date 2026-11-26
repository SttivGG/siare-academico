"""Pruebas de características temporales y ausencia de fuga de datos."""

import unittest
from datetime import datetime, timezone

from app.ml.contracts import parse_attempts
from app.ml.feature_pipeline import build_topic_features


class LearningFeatureTests(unittest.TestCase):
    def setUp(self):
        """Crea cinco intentos sintéticos cronológicos para una prueba local."""
        self.attempts = parse_attempts([
            {"activityId": "00000000-0000-4000-8000-000000000301", "topicId": "fracciones", "correct": False, "score": 1, "maxScore": 5, "occurredAt": "2026-10-01T09:00:00Z"},
            {"activityId": "00000000-0000-4000-8000-000000000302", "topicId": "fracciones", "correct": False, "score": 2, "maxScore": 5, "occurredAt": "2026-10-02T09:00:00Z"},
            {"activityId": "00000000-0000-4000-8000-000000000303", "topicId": "fracciones", "correct": True, "score": 4, "maxScore": 5, "occurredAt": "2026-10-03T09:00:00Z"},
            {"activityId": "00000000-0000-4000-8000-000000000304", "topicId": "fracciones", "correct": False, "score": 2, "maxScore": 5, "occurredAt": "2026-10-04T09:00:00Z"},
            {"activityId": "00000000-0000-4000-8000-000000000305", "topicId": "fracciones", "correct": False, "score": 1, "maxScore": 5, "occurredAt": "2026-10-05T09:00:00Z"},
        ])

    def test_future_attempt_is_excluded_by_decision_time(self):
        """Un corte del 3 de octubre excluye intentos posteriores a esa fecha."""
        decision_time = datetime(2026, 10, 3, 9, 0, tzinfo=timezone.utc)
        features = build_topic_features(self.attempts, "fracciones", decision_time)

        self.assertEqual(features["sampleCount"], 3)
        self.assertAlmostEqual(features["accuracyRate"], 1 / 3)

    def test_consecutive_errors_use_most_recent_attempts(self):
        """Los últimos dos fallos producen una señal consecutiva de dos."""
        decision_time = datetime(2026, 10, 5, 9, 0, tzinfo=timezone.utc)
        features = build_topic_features(self.attempts, "fracciones", decision_time)

        self.assertEqual(features["consecutiveErrors"], 2)


if __name__ == "__main__":
    unittest.main()
