from flask import jsonify


def extraction_response(operation: str | None, payload: dict, status: int = 200):
    response = jsonify({"operationId": operation, **payload})
    response.status_code = status
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
