"""Pruebas del contrato mínimo y del fixture sintético de aprendizaje adaptativo."""

import json
import unittest
import uuid
from datetime import datetime
from pathlib import Path

from app.ml.contracts import ContractValidationError, parse_attempt


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "learning_attempts.json"


class LearningContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Carga el fixture sintético una sola vez para todas las pruebas."""
        cls.fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def test_fixture_is_synthetic_and_reproducible(self):
        """Confirma semilla fija y marca explícita de datos sintéticos."""
        self.assertTrue(self.fixture["synthetic"])
        self.assertEqual(self.fixture["seed"], 20261123)
        self.assertEqual(self.fixture["schemaVersion"], "1.0")

    def test_attempt_fields_are_valid(self):
        """Valida UUID, puntajes, fechas y número mínimo de muestras."""
        topic_counts = {topic: 0 for topic in self.fixture["topics"]}

        for subject in self.fixture["subjects"]:
            uuid.UUID(subject["subjectId"])
            for student in subject["students"]:
                uuid.UUID(student["userId"])
                for raw in student["attempts"]:
                    attempt = parse_attempt(raw)
                    uuid.UUID(attempt.activity_id)
                    datetime.fromisoformat(raw["occurredAt"].replace("Z", "+00:00"))
                    self.assertIn(attempt.topic_id, topic_counts)
                    topic_counts[attempt.topic_id] += 1

        minimum = self.fixture["minimumSamplesByTopic"]
        for topic, count in topic_counts.items():
            self.assertGreaterEqual(count, minimum)

    def test_invalid_attempt_is_rejected(self):
        """Rechaza datos imposibles antes de construir características."""
        invalid = {
            "activityId": "bad-uuid",
            "topicId": "fracciones",
            "correct": False,
            "score": 6,
            "maxScore": 5,
            "occurredAt": "2026-10-01T09:00:00Z",
        }
        with self.assertRaises(ContractValidationError):
            parse_attempt(invalid)


if __name__ == "__main__":
    unittest.main()
