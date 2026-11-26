"""Controlador interno para generación educativa mediante Gemini.

Spring valida usuario y documento antes de llamar estas rutas. Flask no recibe
JWT personales ni decide permisos. Todas las respuestas son JSON y no se cachean.
"""

import hmac
import json
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, request

from app.generative.gemini_service import GeminiUnavailableError
from app.generative.fallback_assessment import build_fallback_assessment
from app.generative.models import GeneratedAssessment, LearningFeedback, TopicClassification
from app.generative.prompts import ASSESSMENT_PROMPT, CLASSIFY_TOPICS_PROMPT, FEEDBACK_PROMPT
from app.generative.validators import (
    GeminiResponseError,
    parse_json_object,
    validate_assessment,
    validate_feedback,
    validate_topic_classification,
)
from app.views.learning_view import learning_response


generative_learning_blueprint = Blueprint("generative_learning", __name__)


def compare_service_token(expected: str, authorization: str) -> bool:
    """Compara el secreto interno sin reutilizar JWT de usuario."""
    if not expected or len(expected) < 32:
        return False
    candidate = "Bearer " + expected
    if len(candidate) != len(authorization):
        return False
    return hmac.compare_digest(candidate, authorization)


def validate_internal_request():
    """Valida autenticación, MIME y tamaño antes de invocar Gemini."""
    secret = current_app.config.get("LEARNING_SERVICE_TOKEN", "")
    authorization = request.headers.get("Authorization", "")
    if not compare_service_token(secret, authorization):
        return learning_response(None, {"errorCode": "UNAUTHORIZED"}, 401)
    if request.mimetype != "application/json":
        return learning_response(None, {"errorCode": "INVALID_CONTENT_TYPE"}, 415)

    maximum = current_app.config.get("GEMINI_MAX_REQUEST_BYTES", 131072)
    if request.content_length is not None and request.content_length > maximum:
        return learning_response(None, {"errorCode": "PAYLOAD_TOO_LARGE"}, 413)
    return None


def validate_uuid(value: object, field_name: str) -> str:
    """Valida UUID canónico y normalizado para correlación y persistencia."""
    if not isinstance(value, str):
        raise GeminiResponseError(f"{field_name} debe ser texto")
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError) as error:
        raise GeminiResponseError(f"{field_name} no es un UUID válido") from error
    if str(parsed) != value:
        raise GeminiResponseError(f"{field_name} debe usar UUID normalizado")
    return value


def gemini_payload(prompt: str) -> dict:
    """Solicita JSON y reintenta una respuesta corregida ante JSON inválido."""
    service = current_app.extensions.get("gemini_service")
    if service is None:
        raise GeminiUnavailableError("Gemini no está configurado")

    correction = (prompt + "\nIMPORTANTE: Devuelve únicamente JSON puro, "
                  "sin Markdown, sin HTML y sin texto adicional.")
    for attempt in range(2):
        try:
            text = service.generate_json(prompt if attempt == 0 else correction)
            return parse_json_object(text)
        except GeminiResponseError:
            if attempt == 1:
                raise


@generative_learning_blueprint.post("/internal/v1/learning/classify-topics")
def classify_topics():
    """Clasifica materia y temas desde texto extraído autorizado por Spring."""
    rejected = validate_internal_request()
    if rejected is not None:
        return rejected

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return learning_response(None, {"errorCode": "VALIDATION"}, 400)

    try:
        request_id = validate_uuid(payload.get("requestId"), "requestId")
        validate_uuid(payload.get("subjectId"), "subjectId")
        validate_uuid(payload.get("documentId"), "documentId")

        content = payload.get("content")
        if not isinstance(content, str) or not content.strip():
            raise GeminiResponseError("content no puede estar vacío")

        maximum_chars = current_app.config.get("GEMINI_MAX_INPUT_CHARS", 100000)
        if len(content) > maximum_chars:
            raise GeminiResponseError("content supera el límite configurado")

        result_payload = gemini_payload(CLASSIFY_TOPICS_PROMPT + content)
        result = validate_topic_classification(result_payload)

    except GeminiResponseError as error:
        return learning_response(payload.get("requestId") if isinstance(payload.get("requestId"), str) else None,
                                 {"errorCode": "VALIDATION", "message": str(error)}, 400)
    except GeminiUnavailableError as error:
        code = str(error)
        status = 429 if code == "RATE_LIMITED" else 503
        return learning_response(payload.get("requestId") if isinstance(payload.get("requestId"), str) else None,
                                 {"errorCode": code}, status)

    return learning_response(request_id, {
        "subjectId": payload["subjectId"],
        "documentId": payload["documentId"],
        "subject": result.subject,
        "topics": list(result.topics),
        "model": current_app.extensions["gemini_service"].model,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }, 200)


@generative_learning_blueprint.post("/internal/v1/learning/generate-assessment")
def generate_assessment():
    """Genera una evaluación estructurada a partir de contenido extraído."""
    rejected = validate_internal_request()
    if rejected is not None:
        return rejected

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return learning_response(None, {"errorCode": "VALIDATION"}, 400)

    try:
        request_id = validate_uuid(payload.get("requestId"), "requestId")
        validate_uuid(payload.get("subjectId"), "subjectId")
        validate_uuid(payload.get("documentId"), "documentId")

        topic = payload.get("topic")
        if not isinstance(topic, str) or not topic.strip():
            raise GeminiResponseError("topic no puede estar vacío")
        topic = topic.strip()

        content = payload.get("content")
        if not isinstance(content, str) or not content.strip():
            raise GeminiResponseError("content no puede estar vacío")

        maximum_chars = current_app.config.get("GEMINI_MAX_INPUT_CHARS", 100000)
        if len(content) > maximum_chars:
            raise GeminiResponseError("content supera el límite configurado")

        maximum_questions = current_app.config.get("GEMINI_MAX_QUESTIONS", 20)
        if not isinstance(maximum_questions, int) or not 1 <= maximum_questions <= 50:
            raise GeminiResponseError("GEMINI_MAX_QUESTIONS no es válido")

        requested = payload.get("questionCount", maximum_questions)
        if not isinstance(requested, int) or isinstance(requested, bool) or not 1 <= requested <= maximum_questions:
            raise GeminiResponseError("questionCount está fuera de rango")

        # El tema explícito tiene prioridad; el PDF aporta hechos, ejemplos y fragmentos.
        prompt = ASSESSMENT_PROMPT + "\nTema exacto solicitado por el usuario: " + topic
        prompt += "\nContenido PDF extraído:\n" + content
        prompt += "\nCantidad exacta solicitada: " + str(requested)

        fallback = None
        try:
            result_payload = gemini_payload(prompt)
            assessment_id = str(uuid.uuid4())
            result: GeneratedAssessment = validate_assessment(
                result_payload, assessment_id, max(requested, maximum_questions)
            )
            if len(result.questions) != requested:
                raise GeminiResponseError("Gemini no devolvió la cantidad exacta solicitada")
            model_name = current_app.extensions["gemini_service"].model
        except (GeminiResponseError, GeminiUnavailableError):
            # Degradación segura: Gemini falla sin bloquear el módulo académico.
            fallback = build_fallback_assessment(topic, content, requested)
            model_name = fallback["model"]

    except GeminiResponseError as error:
        return learning_response(payload.get("requestId") if isinstance(payload.get("requestId"), str) else None,
                                 {"errorCode": "VALIDATION", "message": str(error)}, 400)
    except GeminiUnavailableError as error:
        code = str(error)
        status = 429 if code == "RATE_LIMITED" else 503
        return learning_response(payload.get("requestId") if isinstance(payload.get("requestId"), str) else None,
                                 {"errorCode": code}, status)

    if fallback is not None:
        questions = fallback["questions"]
        assessment_id = fallback["assessmentId"]
    else:
        questions = [{
            "question": question.question,
            "options": [option.text for option in question.options],
            "correctAnswer": question.correct_answer,
            "difficulty": question.difficulty,
            "topicId": question.topic_id,
        } for question in result.questions]
        assessment_id = result.assessment_id

    return learning_response(request_id, {
        "schemaVersion": 1,
        "assessmentId": assessment_id,
        "subjectId": payload["subjectId"],
        "documentId": payload["documentId"],
        "model": model_name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "questions": questions,
    }, 200)


@generative_learning_blueprint.post("/internal/v1/learning/generate-feedback")
def generate_feedback():
    """Genera retroalimentación no diagnóstica basada en señales del modelo."""
    rejected = validate_internal_request()
    if rejected is not None:
        return rejected

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return learning_response(None, {"errorCode": "VALIDATION"}, 400)

    try:
        request_id = validate_uuid(payload.get("requestId"), "requestId")
        validate_uuid(payload.get("studentId"), "studentId")
        validate_uuid(payload.get("subjectId"), "subjectId")

        performance = payload.get("performance")
        dominated = payload.get("dominatedTopics")
        weak = payload.get("weakTopics")
        if not isinstance(performance, dict):
            raise GeminiResponseError("performance debe ser un objeto")
        if not isinstance(dominated, list) or not isinstance(weak, list):
            raise GeminiResponseError("dominatedTopics y weakTopics deben ser listas")

        rendered = json.dumps({
            "performance": performance,
            "dominatedTopics": dominated,
            "weakTopics": weak,
        }, ensure_ascii=False, sort_keys=True)

        if len(rendered) > current_app.config.get("GEMINI_MAX_INPUT_CHARS", 100000):
            raise GeminiResponseError("El payload de retroalimentación supera el límite")

        result_payload = gemini_payload(FEEDBACK_PROMPT + rendered)
        result: LearningFeedback = validate_feedback(result_payload)

    except GeminiResponseError as error:
        return learning_response(payload.get("requestId") if isinstance(payload.get("requestId"), str) else None,
                                 {"errorCode": "VALIDATION", "message": str(error)}, 400)
    except GeminiUnavailableError as error:
        code = str(error)
        status = 429 if code == "RATE_LIMITED" else 503
        return learning_response(payload.get("requestId") if isinstance(payload.get("requestId"), str) else None,
                                 {"errorCode": code}, status)

    return learning_response(request_id, {
        "schemaVersion": 1,
        "studentId": payload["studentId"],
        "subjectId": payload["subjectId"],
        "model": current_app.extensions["gemini_service"].model,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "message": result.message,
        "items": [{"topicId": item.topic_id, "message": item.message} for item in result.items],
        "recommendations": [{
            "topicId": recommendation.topic_id,
            "priority": recommendation.priority,
            "action": recommendation.action,
            "reasonCode": recommendation.reason_code,
        } for recommendation in result.recommendations],
    }, 200)
