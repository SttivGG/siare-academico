"""Controlador HTTP interno para aprendizaje adaptativo.

Este endpoint es propuesto hasta su aprobación. Spring debe validar permisos y
materias antes de enviar datos mínimos a Flask.
"""

import hmac
from datetime import datetime

from flask import Blueprint, current_app, request

from app.ml.contracts import ContractValidationError, parse_attempts, validate_uuid
from app.ml.inference.inference_service import LearningInferenceService
from app.views.learning_view import learning_response


learning_blueprint = Blueprint("learning", __name__)


def compare_service_token(expected: str, authorization: str) -> bool:
    """Compara el Bearer interno con comparación resistente a timing attacks."""
    if not expected or len(expected) < 32:
        return False

    candidate = "Bearer " + expected
    if len(candidate) != len(authorization):
        return False
    return hmac.compare_digest(candidate, authorization)


def validate_service_request():
    """Valida autenticación, tipo de contenido y tamaño antes del contrato."""
    secret = current_app.config.get("LEARNING_SERVICE_TOKEN", "")
    authorization = request.headers.get("Authorization", "")

    if not compare_service_token(secret, authorization):
        return learning_response(None, {"errorCode": "UNAUTHORIZED"}, 401)

    if request.mimetype != "application/json":
        return learning_response(None, {"errorCode": "INVALID_CONTENT_TYPE"}, 415)

    maximum = current_app.config.get("LEARNING_MAX_BYTES", 65536)
    if request.content_length is not None and request.content_length > maximum:
        return learning_response(None, {"errorCode": "REQUEST_TOO_LARGE"}, 413)

    return None


def parse_utc(value: object, field_name: str) -> datetime:
    if not isinstance(value, str):
        raise ContractValidationError(f"{field_name} debe ser texto")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ContractValidationError(f"{field_name} no tiene formato ISO-8601") from error
    if parsed.tzinfo is None:
        raise ContractValidationError(f"{field_name} debe incluir zona horaria")
    return parsed


def parse_v1_observation(raw: object, index: int):
    if not isinstance(raw, dict):
        raise ContractValidationError(f"observations[{index}] debe ser un objeto")

    try:
        attempt_id = validate_uuid(raw["attemptId"], "attemptId")
        topic_id = raw["topicId"]
        score = raw["score"]
        duration_ms = raw["durationMs"]
        occurred_at = parse_utc(raw["occurredAt"], "occurredAt")
    except KeyError as error:
        raise ContractValidationError(f"Falta el campo obligatorio: {error.args[0]}") from error

    if not isinstance(topic_id, str) or not 1 <= len(topic_id.strip()) <= 100:
        raise ContractValidationError("topicId debe tener entre 1 y 100 caracteres")
    if not isinstance(score, (int, float)) or isinstance(score, bool):
        raise ContractValidationError("score debe ser numérico")
    score_value = float(score)
    if score_value < 0 or score_value > 1:
        raise ContractValidationError("score debe estar entre 0 y 1")
    if not isinstance(duration_ms, int) or isinstance(duration_ms, bool):
        raise ContractValidationError("durationMs debe ser entero")
    if duration_ms < 0 or duration_ms > 86400000:
        raise ContractValidationError("durationMs debe estar entre 0 y 86400000")

    return attempt_id, topic_id.strip(), score_value, occurred_at


@learning_blueprint.post("/internal/v1/learning/analyses")
def analyze_learning_v1():
    """Contrato interno v1; Spring debe haber autorizado identidad y ámbito."""
    rejected = validate_service_request()
    if rejected is not None:
        return rejected

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return learning_response(None, {"errorCode": "VALIDATION", "message": "Entrada inválida."}, 400)

    request_id = payload.get("requestId")
    try:
        request_id = validate_uuid(request_id, "requestId")
        validate_uuid(payload["studentId"], "studentId")
        validate_uuid(payload["subjectId"], "subjectId")

        if payload.get("schemaVersion") != 1:
            return learning_response(request_id,
                                     {"errorCode": "UNSUPPORTED_SCHEMA_VERSION"}, 400)

        model_version = payload["modelVersion"]
        if not isinstance(model_version, str) or not 1 <= len(model_version.strip()) <= 64:
            raise ContractValidationError("modelVersion debe tener entre 1 y 64 caracteres")

        # El baseline siempre está disponible. Un modelo supervisado solo puede
        # usarse si fue cargado al iniciar Flask mediante un artefacto JSON.
        registry = current_app.extensions.get("learning_model_registry")
        if model_version != "baseline-error-rate-v1" and (
                registry is None or registry.resolve(model_version) is None):
            return learning_response(request_id,
                                     {"errorCode": "MODEL_UNAVAILABLE",
                                      "message": "La versión del modelo no está disponible."},
                                     503)

        maximum = payload["maxRecommendations"]
        if not isinstance(maximum, int) or isinstance(maximum, bool) or not 1 <= maximum <= 10:
            raise ContractValidationError("maxRecommendations debe estar entre 1 y 10")

        observations = payload["observations"]
        if not isinstance(observations, list) or not 1 <= len(observations) <= 1000:
            raise ContractValidationError("observations debe contener entre 1 y 1000 elementos")

        parsed = [parse_v1_observation(raw, index) for index, raw in enumerate(observations)]
        attempt_ids = [attempt_id for attempt_id, _, _, _ in parsed]
        if len(set(attempt_ids)) != len(attempt_ids):
            raise ContractValidationError("attemptId no puede estar duplicado")

        topic_ids = list(dict.fromkeys(topic for _, topic, _, _ in parsed))

        # Convierte únicamente el modelo mínimo existente a Attempt.
        from app.ml.contracts import Attempt
        attempts = []
        for attempt_id, topic_id, score, occurred_at in parsed:
            threshold = float(current_app.config.get("LEARNING_SUCCESS_SCORE", "0.70"))
            attempts.append(Attempt(
                activity_id=attempt_id,
                topic_id=topic_id,
                correct=score >= threshold,
                score=score,
                max_score=1.0,
                occurred_at=occurred_at,
            ))

    except KeyError as error:
        return learning_response(request_id if isinstance(request_id, str) else None,
                                 {"errorCode": "VALIDATION", "field": error.args[0]}, 400)
    except ContractValidationError as error:
        return learning_response(request_id if isinstance(request_id, str) else None,
                                 {"errorCode": "VALIDATION", "message": str(error)}, 400)

    # Resuelve el artefacto ya cargado. No se ejecuta entrenamiento ni lectura
    # de objetos externos dentro de la solicitud HTTP.
    selected_model = None
    if model_version != "baseline-error-rate-v1":
        selected_model = registry.resolve(model_version)

    result = LearningInferenceService(selected_model).analyze_topics(topic_ids, attempts)

    difficulties = []
    recommendations = []
    for risk_topic in result["riskTopics"]:
        difficulties.append({
            "topicId": risk_topic["topicId"],
            "difficultyScore": risk_topic["riskScore"],
            "observationCount": risk_topic["sampleCount"],
        })

    for index, recommendation in enumerate(result["recommendations"][:maximum], start=1):
        if recommendation["topicId"] not in topic_ids:
            continue
        recommendations.append({
            "topicId": recommendation["topicId"],
            "priority": index,
            "action": "PRACTICE_TOPIC" if recommendation["action"] == "PRACTICE" else "REVIEW_TOPIC",
            "reasonCode": "LOW_MASTERY",
        })

    if result["insufficientEvidence"]:
        return learning_response(request_id, {
            "schemaVersion": 1,
            "studentId": payload["studentId"],
            "subjectId": payload["subjectId"],
            "modelVersion": result["modelVersion"],
            "analyzedAt": datetime.now().astimezone().isoformat(),
            "insufficientEvidence": True,
            "difficulties": difficulties,
            "recommendations": recommendations,
        }, 422 if not difficulties else 200)

    return learning_response(request_id, {
        "schemaVersion": 1,
        "studentId": payload["studentId"],
        "subjectId": payload["subjectId"],
        "modelVersion": result["modelVersion"],
        "analyzedAt": datetime.now().astimezone().isoformat(),
        "insufficientEvidence": False,
        "difficulties": difficulties,
        "recommendations": recommendations,
    }, 200)


@learning_blueprint.post("/internal/v1/learning/analyze")
def analyze_learning_legacy():
    """Alias temporal compatible con la implementación previa."""
    return _analyze_learning_legacy_impl()


def _analyze_learning_legacy_impl():
    rejected = validate_service_request()
    if rejected is not None:
        return rejected

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return learning_response(None, {"errorCode": "INVALID_REQUEST"}, 400)

    try:
        request_id = validate_uuid(payload["requestId"], "requestId")
        validate_uuid(payload["userId"], "userId")
        validate_uuid(payload["subjectId"], "subjectId")
        if "attempts" not in payload:
            raise ContractValidationError("Falta el campo obligatorio: attempts")
        attempts = parse_attempts(payload["attempts"])

        requested_topics = payload.get("topicIds")
        if requested_topics is None:
            topic_ids = list(dict.fromkeys(attempt.topic_id for attempt in attempts))
        else:
            if not isinstance(requested_topics, list) or not requested_topics:
                raise ContractValidationError("topicIds debe ser una lista no vacía")
            if len(requested_topics) > 100:
                raise ContractValidationError("topicIds supera el límite de 100 temas")
            topic_ids = list(dict.fromkeys(topic_id.strip() for topic_id in requested_topics
                                           if isinstance(topic_id, str) and topic_id.strip()))
            if len(topic_ids) != len(requested_topics):
                raise ContractValidationError("topicIds contiene un identificador inválido")
    except KeyError as error:
        return learning_response(None,
                                 {"errorCode": "INVALID_REQUEST", "field": error.args[0]}, 400)
    except ContractValidationError as error:
        return learning_response(payload.get("requestId") if isinstance(payload.get("requestId"), str) else None,
                                 {"errorCode": "INVALID_REQUEST", "reason": str(error)}, 400)

    result = LearningInferenceService().analyze_topics(topic_ids, attempts)
    return learning_response(request_id, result, 200)
