"""Benchmark sintético secuencial/paralelo de análisis por tema."""

from timeit import repeat

from app.ml.contracts import parse_attempts
from app.ml.inference.inference_service import LearningInferenceService


TOPICS = ["fracciones", "algebra", "geometria", "estadistica",
          "numeros", "probabilidad", "calculo", "razonamiento"]
ATTEMPTS = []
activity = 1
for topic_index, topic in enumerate(TOPICS):
    for attempt_index in range(1, 101):
        ATTEMPTS.append({
            "activityId": f"00000000-0000-4000-8000-{activity:012d}",
            "topicId": topic,
            "correct": (attempt_index + topic_index) % 3 != 0,
            "score": 4 if (attempt_index + topic_index) % 3 != 0 else 1,
            "maxScore": 5,
            "occurredAt": f"2026-11-{(attempt_index % 28) + 1:02d}T10:30:00Z",
        })
        activity += 1

attempts = parse_attempts(ATTEMPTS)
service = LearningInferenceService()


sequential_times = repeat(
    "[service.analyze_topic(topic, attempts) for topic in TOPICS]",
    globals=globals(), number=20, repeat=5,
)
parallel_times = repeat(
    "service.analyze_topics(TOPICS, attempts)",
    globals=globals(), number=20, repeat=5,
)

print({
    "synthetic": True,
    "topics": len(TOPICS),
    "attempts": len(attempts),
    "sequentialSecondsMin": round(min(sequential_times), 6),
    "parallelSecondsMin": round(min(parallel_times), 6),
})
