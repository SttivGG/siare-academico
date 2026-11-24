"""Carga y resolución de artefactos de inferencia versionados.

La implementación actual conserva el baseline como modelo activo por defecto.
Un artefacto supervisado puede registrarse mediante JSON seguro sin modificar
el controlador HTTP ni entrenar durante una petición.
"""

import json
from pathlib import Path

from app.ml.models.logistic_risk import LogisticRiskModel


BASELINE_VERSION = "baseline-error-rate-v1"


class ModelRegistry:
    """Resuelve el modelo disponible por su versión declarada."""

    def __init__(self, artifact_path: str | None = None):
        self.artifact_path = artifact_path
        self._models: dict[str, LogisticRiskModel] = {}

    def load_artifact(self) -> LogisticRiskModel:
        """Carga y valida un artefacto JSON desde disco.

        El archivo debe contener parámetros exportados por LogisticRiskModel;
        no se aceptan archivos pickle, joblib ni objetos Python ejecutables.
        """
        if not self.artifact_path:
            raise FileNotFoundError("No hay ruta de artefacto configurada")

        path = Path(self.artifact_path)
        if not path.is_file():
            raise FileNotFoundError(f"No existe el artefacto: {path.name}")

        with path.open("r", encoding="utf-8") as artifact:
            parameters = json.load(artifact)

        model = LogisticRiskModel.from_parameters(parameters)
        self._models[model.model_version] = model
        return model

    def resolve(self, model_version: str) -> LogisticRiskModel | None:
        """Devuelve un modelo supervisado cargado o None si no está disponible."""
        if model_version == BASELINE_VERSION:
            return None
        return self._models.get(model_version)

    def register(self, model: LogisticRiskModel) -> None:
        """Registra en memoria un modelo ya validado y reconstruido."""
        self._models[model.model_version] = model
