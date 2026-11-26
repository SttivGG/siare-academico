"""Evaluación del modelo con métricas binarias y matriz de confusión."""

from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from app.ml.models.logistic_risk import LogisticRiskModel
from app.ml.training.dataset import feature_row


def evaluate_logistic_risk(model: LogisticRiskModel, rows: list[dict]) -> dict:
    """Mide el modelo solo sobre datos reservados para validación o prueba."""
    if not rows:
        raise ValueError("No hay filas reservadas para evaluar")

    labels = [int(row["label"]) for row in rows]
    features = [feature_row(row) for row in rows]
    probabilities = [model.predict_risk(row) for row in features]
    predictions = [1 if probability >= 0.5 else 0 for probability in probabilities]

    metrics = {
        "sampleCount": len(rows),
        "accuracy": round(float(accuracy_score(labels, predictions)), 6),
        "precision": round(float(precision_score(labels, predictions, zero_division=0)), 6),
        "recall": round(float(recall_score(labels, predictions, zero_division=0)), 6),
        "f1": round(float(f1_score(labels, predictions, zero_division=0)), 6),
        "confusionMatrix": confusion_matrix(labels, predictions, labels=[0, 1]).tolist(),
    }

    try:
        metrics["auc"] = round(float(roc_auc_score(labels, probabilities)), 6)
    except ValueError:
        # AUC no puede calcularse si la partición reservada contiene una sola clase.
        metrics["auc"] = None

    return metrics
