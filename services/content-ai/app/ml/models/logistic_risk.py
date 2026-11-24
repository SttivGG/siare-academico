"""Modelo supervisado compacto de regresión logística para riesgo académico.

El adaptador usa scikit-learn, pero exporta parámetros JSON normales. Así el
servicio puede reemplazar el motor sin guardar objetos pickle externos no confiables.
"""

from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.models.base import RiskModel


class LogisticRiskModel(RiskModel):
    """Clasificador binario con escalado y balance automático de clases."""

    def __init__(self, seed: int = 20261123, model_version: str = "ml-v1"):
        """Configura semilla y pipeline reproducible sin entrenar todavía."""
        self.seed = seed
        self._model_version = model_version

        # Escalar evita que una característica con valores grandes domine el modelo.
        self.pipeline = Pipeline([
            ("scale", StandardScaler()),
            ("logistic", LogisticRegression(
                l1_ratio=0.0,
                solver="lbfgs",
                class_weight="balanced",
                random_state=seed,
                max_iter=500,
            )),
        ])
        self._feature_names: list[str] = []

    @property
    def model_version(self) -> str:
        """Devuelve la versión utilizada en resultados y artefactos."""
        return self._model_version

    def fit(self, feature_rows: list[list[float]], labels: list[int]) -> None:
        """Entrena si existen muestras suficientes y ambas clases 0/1."""
        if len(feature_rows) != len(labels):
            raise ValueError("feature_rows y labels deben tener la misma longitud")
        if len(feature_rows) < 10:
            raise ValueError("Se requieren al menos 10 muestras")
        if set(labels) != {0, 1}:
            raise ValueError("Las etiquetas deben contener ambas clases")

        self.pipeline.fit(feature_rows, labels)

    def predict_risk(self, feature_row: list[float]) -> float:
        """Devuelve una probabilidad de riesgo limitada al intervalo [0, 1]."""
        logistic = self.pipeline.named_steps["logistic"]
        if not hasattr(logistic, "classes_"):
            raise RuntimeError("El modelo no está entrenado")

        positive_index = list(logistic.classes_).index(1)
        probability = self.pipeline.predict_proba([feature_row])[0][positive_index]
        return round(float(probability), 6)

    def set_feature_names(self, feature_names: list[str]) -> None:
        """Registra nombres y orden de las columnas usadas por el modelo."""
        self._feature_names = list(feature_names)

    @classmethod
    def from_parameters(cls, parameters: dict) -> "LogisticRiskModel":
        """Reconstruye un modelo aprobado desde parámetros JSON seguros.

        No deserializa objetos Python externos ni ejecuta código arbitrario.
        Valida versión, algoritmo, características y dimensiones antes de cargarlo.
        """
        if not isinstance(parameters, dict):
            raise ValueError("El artefacto debe ser un objeto JSON")
        if parameters.get("algorithm") != "logistic_regression":
            raise ValueError("El algoritmo del artefacto no está soportado")

        feature_names = parameters.get("featureNames")
        mean = parameters.get("mean")
        scale = parameters.get("scale")
        coefficients = parameters.get("coefficients")
        intercept = parameters.get("intercept")

        if not isinstance(feature_names, list) or not feature_names:
            raise ValueError("El artefacto no declara featureNames")
        if not all(isinstance(value, str) for value in feature_names):
            raise ValueError("featureNames contiene valores inválidos")

        if any(not isinstance(group, list) for group in (mean, scale, coefficients)):
            raise ValueError("El artefacto contiene parámetros numéricos inválidos")

        expected = len(feature_names)
        if len(mean) != expected or len(scale) != expected or len(coefficients) != expected:
            raise ValueError("Las dimensiones del artefacto no coinciden")
        if any(value == 0 for value in scale):
            raise ValueError("La escala contiene valores cero")

        try:
            numeric_mean = [float(value) for value in mean]
            numeric_scale = [float(value) for value in scale]
            numeric_coefficients = [float(value) for value in coefficients]
            numeric_intercept = float(intercept)
        except (TypeError, ValueError) as error:
            raise ValueError("Los parámetros numéricos del artefacto no son válidos") from error

        model_version = parameters.get("modelVersion")
        if not isinstance(model_version, str) or not 1 <= len(model_version) <= 64:
            raise ValueError("El artefacto contiene una modelVersion inválida")

        seed = parameters.get("seed", 20261123)
        if not isinstance(seed, int) or isinstance(seed, bool):
            raise ValueError("La semilla del artefacto no es válida")

        model = cls(seed=seed, model_version=model_version)
        model.set_feature_names(feature_names)

        import numpy as np

        scaler = model.pipeline.named_steps["scale"]
        logistic = model.pipeline.named_steps["logistic"]
        scaler.mean_ = np.asarray(numeric_mean, dtype=float)
        scaler.scale_ = np.asarray(numeric_scale, dtype=float)
        scaler.var_ = np.asarray([value * value for value in numeric_scale], dtype=float)
        scaler.n_features_in_ = expected
        logistic.coef_ = np.asarray([numeric_coefficients], dtype=float)
        logistic.intercept_ = np.asarray([numeric_intercept], dtype=float)
        logistic.classes_ = np.asarray([0, 1], dtype=int)
        logistic.n_features_in_ = expected

        return model

    def to_parameters(self) -> dict:
        """Exporta parámetros JSON seguros sin serialización pickle."""
        logistic = self.pipeline.named_steps["logistic"]
        scaler = self.pipeline.named_steps["scale"]
        if not hasattr(logistic, "coef_"):
            raise RuntimeError("El modelo no está entrenado")

        return {
            "modelVersion": self.model_version,
            "algorithm": "logistic_regression",
            "seed": self.seed,
            "featureNames": self._feature_names,
            "mean": [round(float(value), 8) for value in scaler.mean_.tolist()],
            "scale": [round(float(value), 8) for value in scaler.scale_.tolist()],
            "coefficients": [round(float(value), 8) for value in logistic.coef_[0].tolist()],
            "intercept": round(float(logistic.intercept_[0]), 8),
        }
