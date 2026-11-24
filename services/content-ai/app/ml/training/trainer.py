"""Entrenamiento reproducible de la regresión logística.

El entrenamiento se ejecuta fuera de las solicitudes HTTP y recibe solo el conjunto
de entrenamiento previamente separado por el proceso temporal.
"""

from app.ml.models.logistic_risk import LogisticRiskModel
from app.ml.training.dataset import FEATURE_NAMES, feature_row


SEED = 20261123
MODEL_VERSION = "ml-v1"


def train_logistic_risk(rows: list[dict]) -> LogisticRiskModel:
    """Entrena el modelo si existen ambas clases y al menos diez muestras."""
    if len(rows) < 10:
        raise ValueError("El entrenamiento requiere al menos 10 muestras")

    labels = [int(row["label"]) for row in rows]
    if set(labels) != {0, 1}:
        raise ValueError("El entrenamiento debe contener ambas clases")

    model = LogisticRiskModel(seed=SEED, model_version=MODEL_VERSION)
    model.set_feature_names(FEATURE_NAMES)
    model.fit([feature_row(row) for row in rows], labels)
    return model
