"""Prueba determinística del análisis concurrente por tema."""

import unittest

from app.ml.contracts import parse_attempts
from app.ml.inference.inference_service import LearningInferenceService


class LearningParallelTests(unittest.TestCase):
    def setUp(self):
        self.attempts = parse_attempts([
            {"activityId": f"00000000-0000-4000-8000-{index:012d}",
             "topicId": topic,
             "correct": index % 2 == 0,
             "score": 4 if index % 2 == 0 else 1,
             "maxScore": 5,
             "occurredAt": f"2026-11-{index:02d}T10:30:00Z"}
            for topic in ("fracciones", "algebra", "geometria")
            for index in range(1, 6)
        ])

    def test_parallel_matches_sequential_topic_results(self):
        service = LearningInferenceService()
        topic_ids = ["fracciones", "algebra", "geometria"]

        sequential = [service.analyze_topic(topic_id, self.attempts)
                      for topic_id in topic_ids]
        parallel = service.analyze_topics(topic_ids, self.attempts)

        self.assertEqual(len(parallel["riskTopics"]), 3)
        self.assertEqual(
            [item["topicId"] for item in parallel["riskTopics"]],
            [item["riskTopics"][0]["topicId"] for item in sequential],
        )


if __name__ == "__main__":
    unittest.main()
