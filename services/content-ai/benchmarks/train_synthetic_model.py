"""Entrenamiento reproducible y fuera de HTTP para la versión sintética ml-v1.

Este script demuestra el pipeline de la primera versión sin afirmar que datos reales
existen. Genera intentos ficticios, respeta una partición temporal y exporta solo
parámetros JSON seguros para que Flask los cargue al iniciar.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import json

from app.ml.contracts import Attempt
from app.ml.training.dataset import attempts_to_topic_dataset, split_by_position
from app.ml.training.trainer import train_logistic_risk
from app.ml.training.evaluator import evaluate_logistic_risk


def build_synthetic_attempts(topic_ids: tuple[str, ...], count_per_topic: int = 120) -> list[Attempt]:
    """Construye intentos ordenados y reproducibles; no usa identidades reales."""
    attempts = []
    start = datetime(2026, 10, 1, tzinfo=timezone.utc)

    for topic_index, topic_id in enumerate(topic_ids):
        for index in range(count_per_topic):
            # La dificultad cambia por tema y se vuelve más exigente con el tiempo.
            probability_failure = min(0.82, 0.28 + topic_index * 0.06 + (index % 17) * 0.015)
            correct = ((index * 37 + topic_index * 11) % 100) >= int(probability_failure * 100)
            score = 0.8 if correct else 0.25
            attempts.append(Attempt(
                activity_id=f"00000000-0000-4000-8000-{topic_index * count_per_topic + index + 1:012d}",
                topic_id=topic_id,
                correct=correct,
                score=score,
                max_score=1.0,
                occurred_at=start + timedelta(minutes=index * 10 + topic_index),
            ))

    return attempts


def baseline_metrics(rows: list[dict]) -> dict:
    """Evalúa la línea base simple 1 - accuracyRate para comparación directa."""
    labels = [int(row["label"]) for row in rows]
    predictions = [1 if 1.0 - float(row["accuracyRate"]) >= 0.5 else 0 for row in rows]

    tp = sum(label == 1 and prediction == 1 for label, prediction in zip(labels, predictions))
    tn = sum(label == 0 and prediction == 0 for label, prediction in zip(labels, predictions))
    fp = sum(label == 0 and prediction == 1 for label, prediction in zip(labels, predictions))
    fn = sum(label == 1 and prediction == 0 for label, prediction in zip(labels, predictions))

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    return {
        "sampleCount": len(rows),
        "accuracy": round((tp + tn) / len(rows), 6),
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "f1": round(f1, 6),
        "confusionMatrix": [[tn, fp], [fn, tp]],
        "auc": None,
    }


def main() -> None:
    topics = ("fracciones", "algebra", "geometria", "estadistica")
    attempts = build_synthetic_attempts(topics)

    rows = []
    for topic_id in topics:
        rows.extend(attempts_to_topic_dataset(attempts, topic_id))

    train_rows, test_rows = split_by_position(rows, 0.70)
    model = train_logistic_risk(train_rows)
    model_metrics = evaluate_logistic_risk(model, test_rows)
    baseline = baseline_metrics(test_rows)

    root = Path(__file__).resolve().parents[1]
    artifact_dir = root / "app" / "ml" / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    artifact_path = artifact_dir / "ml-v1.json"
    artifact_path.write_text(json.dumps(model.to_parameters(), indent=2, sort_keys=True) + "\n", encoding="utf-8")

    report = {
        "synthetic": True,
        "seed": 20261123,
        "modelVersion": "ml-v1",
        "topics": list(topics),
        "attemptCount": len(attempts),
        "rowCount": len(rows),
        "trainCount": len(train_rows),
        "testCount": len(test_rows),
        "partition": "positional temporal synthetic rows; future attempt excluded",
        "model": model_metrics,
        "baseline": baseline,
    }

    report_path = root / "benchmarks" / "learning_synthetic_report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps({
        "artifact": str(artifact_path.relative_to(root)),
        "report": str(report_path.relative_to(root)),
        "model": model_metrics,
        "baseline": baseline,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
