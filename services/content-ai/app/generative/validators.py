"""Validadores estrictos para respuestas JSON producidas por Gemini.

La validación impide HTML, Markdown ejecutable, índices inválidos, tipos incorrectos
y cantidades fuera de los límites configurados antes de devolver datos a Spring.
"""

import json
import re
import uuid
from typing import Any

from app.generative.models import (
    FeedbackItem,
    GeneratedAssessment,
    LearningFeedback,
    Question,
    QuestionOption,
    Recommendation,
    TopicClassification,
)


BLOCKED_MARKUP = re.compile(r"<[^>]+>|```|\[!|javascript:", re.IGNORECASE)


class GeminiResponseError(ValueError):
    """Indica que Gemini no devolvió una respuesta JSON estructuralmente válida."""


def parse_json_object(text: str) -> dict[str, Any]:
    """Extrae y valida un objeto JSON único sin aceptar texto ejecutable."""
    if not isinstance(text, str) or not text.strip():
        raise GeminiResponseError("Gemini devolvió una respuesta vacía")

    # Gemini suele devolver bloques auxiliares; solo se acepta JSON puro o
    # el primer bloque de código JSON, nunca texto arbitrario fuera del objeto.
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    if BLOCKED_MARKUP.search(cleaned):
        raise GeminiResponseError("La respuesta contiene formato no permitido")

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise GeminiResponseError("La respuesta no contiene JSON válido") from error

    if not isinstance(payload, dict):
        raise GeminiResponseError("La respuesta JSON no es un objeto")
    return payload


def clean_text(value: object, field: str, maximum: int = 2000) -> str:
    """Valida texto plano y rechaza HTML, Markdown o entradas vacías."""
    if not isinstance(value, str):
        raise GeminiResponseError(f"{field} debe ser texto")
    text = value.strip()
    if not text:
        raise GeminiResponseError(f"{field} no puede estar vacío")
    if len(text) > maximum:
        raise GeminiResponseError(f"{field} supera el límite de caracteres")
    if BLOCKED_MARKUP.search(text):
        raise GeminiResponseError(f"{field} contiene formato no permitido")
    return text


def validate_assessment(payload: dict[str, Any], assessment_id: str,
                       maximum_questions: int) -> GeneratedAssessment:
    """Convierte JSON Gemini a un modelo de evaluación validado."""
    raw_questions = payload.get("questions")
    if not isinstance(raw_questions, list) or not 1 <= len(raw_questions) <= maximum_questions:
        raise GeminiResponseError("questions debe contener entre 1 y el máximo permitido")

    questions: list[Question] = []
    for index, raw in enumerate(raw_questions):
        if not isinstance(raw, dict):
            raise GeminiResponseError(f"questions[{index}] debe ser un objeto")

        options = raw.get("options")
        if not isinstance(options, list) or not 2 <= len(options) <= 6:
            raise GeminiResponseError("Cada pregunta debe tener entre 2 y 6 opciones")

        cleaned_options = tuple(
            QuestionOption(clean_text(option, f"options[{option_index}]", 500))
            for option_index, option in enumerate(options)
        )

        # Rechaza opciones duplicadas porque una clave ambigua impediría evaluar correctamente.
        option_texts = [option.text.strip().casefold() for option in cleaned_options]
        if len(set(option_texts)) != len(option_texts):
            raise GeminiResponseError("Las opciones no pueden estar duplicadas")

        correct_answer = raw.get("correctAnswer")
        if not isinstance(correct_answer, int) or isinstance(correct_answer, bool):
            raise GeminiResponseError("correctAnswer debe ser entero")
        if correct_answer < 0 or correct_answer >= len(cleaned_options):
            raise GeminiResponseError("correctAnswer está fuera de rango")

        difficulty = raw.get("difficulty")
        if difficulty not in {"BASIC", "INTERMEDIATE", "ADVANCED"}:
            raise GeminiResponseError("difficulty no está permitido")

        questions.append(Question(
            question=clean_text(raw.get("question"), "question", 1000),
            options=cleaned_options,
            correct_answer=correct_answer,
            difficulty=difficulty,
            topic_id=clean_text(raw.get("topicId"), "topicId", 100),
        ))

    try:
        uuid.UUID(assessment_id)
    except (ValueError, AttributeError) as error:
        raise GeminiResponseError("assessmentId no es un UUID válido") from error

    return GeneratedAssessment(assessment_id, tuple(questions))


def validate_topic_classification(payload: dict[str, Any]) -> TopicClassification:
    """Convierte JSON Gemini a una clasificación de materia y temas."""
    subject = clean_text(payload.get("subject"), "subject", 200)
    raw_topics = payload.get("topics")
    if not isinstance(raw_topics, list) or len(raw_topics) > 20:
        raise GeminiResponseError("topics debe ser una lista de hasta 20 elementos")

    topics = tuple(clean_text(topic, "topic", 100) for topic in raw_topics)
    if len(set(topics)) != len(topics):
        raise GeminiResponseError("topics no puede contener duplicados")
    return TopicClassification(subject=subject, topics=topics)


def validate_feedback(payload: dict[str, Any], maximum_items: int = 20) -> LearningFeedback:
    """Convierte JSON Gemini a retroalimentación educativa validada."""
    message = clean_text(payload.get("message"), "message", 2000)

    raw_items = payload.get("items")
    if not isinstance(raw_items, list) or len(raw_items) > maximum_items:
        raise GeminiResponseError("items debe ser una lista acotada")

    items: list[FeedbackItem] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            raise GeminiResponseError("FeedbackItem debe ser un objeto")
        items.append(FeedbackItem(
            topic_id=clean_text(raw.get("topicId"), "topicId", 100),
            message=clean_text(raw.get("message"), "message", 1000),
        ))

    raw_recommendations = payload.get("recommendations")
    if not isinstance(raw_recommendations, list) or len(raw_recommendations) > 10:
        raise GeminiResponseError("recommendations debe ser una lista acotada")

    recommendations: list[Recommendation] = []
    priorities: list[int] = []
    for raw in raw_recommendations:
        if not isinstance(raw, dict):
            raise GeminiResponseError("Recommendation debe ser un objeto")
        priority = raw.get("priority")
        action = raw.get("action")
        if not isinstance(priority, int) or isinstance(priority, bool) or priority < 1:
            raise GeminiResponseError("priority debe ser entero positivo")
        if action not in {"REVIEW_TOPIC", "PRACTICE_TOPIC", "MAINTAIN"}:
            raise GeminiResponseError("action no está permitido")
        priorities.append(priority)
        recommendations.append(Recommendation(
            topic_id=clean_text(raw.get("topicId"), "topicId", 100),
            priority=priority,
            action=action,
            reason_code=clean_text(raw.get("reasonCode"), "reasonCode", 100),
        ))

    if len(set(priorities)) != len(priorities):
        raise GeminiResponseError("Las prioridades de recomendación no pueden repetirse")

    return LearningFeedback(message=message, items=tuple(items), recommendations=tuple(recommendations))
