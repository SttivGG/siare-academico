"""Construcción segura de respuestas HTTP para aprendizaje adaptativo."""

from flask import jsonify


def learning_response(request_id: str | None, payload: dict, status: int = 200):
    """Añade correlación y evita caché; no incluye excepciones internas ni secretos."""
    response = jsonify({"requestId": request_id, **payload})
    response.status_code = status
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
