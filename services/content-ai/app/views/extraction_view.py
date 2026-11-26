from flask import jsonify


def extraction_response(operation: str | None, payload: dict, status: int = 200):
    """Genera una respuesta JSON para las operaciones de extracción.

    Args:
        operation (str | None): El ID de la operación.
        payload (dict): Los datos a incluir en la respuesta.
        status (int, opcional): El código de estado HTTP. Por defecto es 200.

    Returns:
        respuesta: La respuesta JSON con encabezados de seguridad.
    """
    response = jsonify({"operationId": operation, **payload})
    response.status_code = status
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
