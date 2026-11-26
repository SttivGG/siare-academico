"""Benchmark sintético secuencial/paralelo de análisis por tema.

Compara dos estrategias reales con lote acotado y reporta mediana, variabilidad,
CPU y memoria. No confunde los hilos HTTP con paralelismo algorítmico.
"""

import statistics
import time
import tracemalloc

try:
    import resource
except ImportError:
    resource = None

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


def measure(operation, repetitions=5):
    """Mide tiempo, memoria Python pico y CPU disponible de forma acotada."""
    durations = []
    cpu_times = []
    peak_bytes = []

    for _ in range(repetitions):
        tracemalloc.start()
        started = time.perf_counter()
        operation()
        durations.append(time.perf_counter() - started)
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        peak_bytes.append(peak)
        if resource is not None:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            cpu_times.append(usage.ru_utime + usage.ru_stime)

    return {
        "medianSeconds": round(statistics.median(durations), 6),
        "minSeconds": round(min(durations), 6),
        "maxSeconds": round(max(durations), 6),
        "medianPeakPythonBytes": int(statistics.median(peak_bytes)),
        "cpuSecondsDeltaMedian": round(statistics.median(cpu_times), 6) if cpu_times else None,
    }


sequential = measure(lambda: [service.analyze_topic(topic, attempts) for topic in TOPICS])
parallel = measure(lambda: service.analyze_topics(TOPICS, attempts))

print({
    "synthetic": True,
    "topics": len(TOPICS),
    "attempts": len(attempts),
    "workers": 4,
    "repetitions": 5,
    "sequential": sequential,
    "parallel": parallel,
})
