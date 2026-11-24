"""Interfaz común para modelos de riesgo académico.

Implementar esta interfaz permite reemplazar la regresión logística sin modificar
el pipeline, el endpoint ni las características existentes.
"""

from abc import ABC, abstractmethod


class RiskModel(ABC):
    """Contrato mínimo compartido por todos los modelos predictivos."""

    @property
    @abstractmethod
    def model_version(self) -> str:
        """Devuelve la versión reproducible del modelo activo."""

    @abstractmethod
    def fit(self, feature_rows: list[list[float]], labels: list[int]) -> None:
        """Entrena con características numéricas y etiquetas binarias."""

    @abstractmethod
    def predict_risk(self, feature_row: list[float]) -> float:
        """Predice el riesgo como una probabilidad entre cero y uno."""

    @abstractmethod
    def to_parameters(self) -> dict:
        """Exporta parámetros seguros serializables en JSON, sin objetos externos."""
