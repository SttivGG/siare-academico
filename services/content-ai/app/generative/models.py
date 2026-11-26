"""Modelos de datos estrictos para contenido generado por Gemini.

Estos modelos separan la respuesta externa del contrato HTTP de Flask y evitan
propagar texto libre, HTML o estructura arbitraria a Spring o al cliente.
"""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class QuestionOption:
    """Una opción visible de una pregunta generada."""

    text: str


@dataclass(frozen=True)
class Question:
    """Pregunta estructurada con índice de respuesta y dificultad declarada."""

    question: str
    options: tuple[QuestionOption, ...]
    correct_answer: int
    difficulty: Literal["BASIC", "INTERMEDIATE", "ADVANCED"]
    topic_id: str


@dataclass(frozen=True)
class GeneratedAssessment:
    """Evaluación completa producida por Gemini y validada localmente."""

    assessment_id: str
    questions: tuple[Question, ...]


@dataclass(frozen=True)
class FeedbackItem:
    """Retroalimentación segura asociada a un tema académico."""

    topic_id: str
    message: str


@dataclass(frozen=True)
class Recommendation:
    """Acción educativa sugerida; no modifica calificaciones ni decisiones."""

    topic_id: str
    priority: int
    action: Literal["REVIEW_TOPIC", "PRACTICE_TOPIC", "MAINTAIN"]
    reason_code: str


@dataclass(frozen=True)
class LearningFeedback:
    """Resultado agregado de retroalimentación para Spring."""

    message: str
    items: tuple[FeedbackItem, ...]
    recommendations: tuple[Recommendation, ...]


@dataclass(frozen=True)
class TopicClassification:
    """Clasificación curricular devuelta por Gemini para texto extraído."""

    subject: str
    topics: tuple[str, ...]
