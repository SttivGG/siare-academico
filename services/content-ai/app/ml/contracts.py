"""Contratos internos del módulo de aprendizaje adaptativo.

Este archivo define el intento mínimo que puede analizar Flask. El contrato actual
usa datos sintéticos y debe sustituirse o ampliarse después de acordarlo con Spring.
No incluye nombres, correos, contraseñas, documentos ni claves.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Mapping, Sequence
import uuid


class ContractValidationError(ValueError):
    """Indica que una solicitud o intento no cumple el contrato mínimo."""


@dataclass(frozen=True)
class Attempt:
    """Representa un intento académico ya evaluado por el backend principal."""

    activity_id: str
    topic_id: str
    correct: bool
    score: float
    max_score: float
    occurred_at: datetime


def validate_uuid(value: object, field_name: str) -> str:
    """Valida que un identificador tenga formato UUID normalizado."""
    if not isinstance(value, str):
        raise ContractValidationError(f"{field_name} debe ser texto")

    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError) as error:
        raise ContractValidationError(f"{field_name} no es un UUID válido") from error

    if str(parsed) != value:
        raise ContractValidationError(f"{field_name} debe usar UUID normalizado")
    return value


def parse_timestamp(value: object) -> datetime:
    """Convierte una fecha ISO-8601 UTC o con zona horaria a datetime consciente."""
    if not isinstance(value, str):
        raise ContractValidationError("occurredAt debe ser texto")

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ContractValidationError("occurredAt no tiene formato ISO-8601") from error

    if parsed.tzinfo is None:
        raise ContractValidationError("occurredAt debe incluir zona horaria")
    return parsed


def parse_attempt(raw: Mapping[str, object]) -> Attempt:
    """Valida y transforma un intento externo a la representación interna del ML."""
    try:
        activity_id = validate_uuid(raw["activityId"], "activityId")
        topic_id = raw["topicId"]
        correct = raw["correct"]
        score = raw["score"]
        max_score = raw["maxScore"]
        occurred_at = parse_timestamp(raw["occurredAt"])
    except KeyError as error:
        raise ContractValidationError(f"Falta el campo obligatorio: {error.args[0]}") from error

    if not isinstance(topic_id, str) or not topic_id.strip():
        raise ContractValidationError("topicId debe ser un identificador no vacío")
    if not isinstance(correct, bool):
        raise ContractValidationError("correct debe ser booleano")
    if not isinstance(score, (int, float)) or isinstance(score, bool):
        raise ContractValidationError("score debe ser numérico")
    if not isinstance(max_score, (int, float)) or isinstance(max_score, bool):
        raise ContractValidationError("maxScore debe ser numérico")

    numeric_score = float(score)
    numeric_max_score = float(max_score)

    if numeric_score < 0:
        raise ContractValidationError("score no puede ser negativo")
    if numeric_max_score <= 0:
        raise ContractValidationError("maxScore debe ser mayor que cero")
    if numeric_score > numeric_max_score:
        raise ContractValidationError("score no puede superar maxScore")

    return Attempt(activity_id, topic_id.strip(), correct, numeric_score,
                   numeric_max_score, occurred_at)


def parse_attempts(raw_attempts: Sequence[Mapping[str, object]]) -> list[Attempt]:
    """Valida una lista acotada y la ordena cronológicamente."""
    if not isinstance(raw_attempts, (list, tuple)):
        raise ContractValidationError("attempts debe ser una lista")
    if len(raw_attempts) > 1000:
        raise ContractValidationError("attempts supera el límite de 1000 intentos")

    attempts = [parse_attempt(raw) for raw in raw_attempts]
    return sorted(attempts, key=lambda attempt: attempt.occurred_at)
