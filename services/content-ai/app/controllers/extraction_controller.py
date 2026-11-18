import hmac
import os
import tempfile
import uuid

from flask import Blueprint, current_app, request
from werkzeug.exceptions import RequestEntityTooLarge
from app.views.extraction_view import extraction_response

extraction_blueprint = Blueprint("extractions", __name__)
MIMES = {"PDF": "application/pdf", "DOCX": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
         "PPTX": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "JPEG": "image/jpeg", "PNG": "image/png"}


@extraction_blueprint.post("/internal/v1/extractions")
def extract_document():
    secret = current_app.config["CONTENT_SERVICE_TOKEN"]
    authorization = request.headers.get("Authorization", "")
    if not secret or len(secret) < 32 or not hmac.compare_digest(authorization.encode(), ("Bearer " + secret).encode()):
        return extraction_response(None, {"errorCode": "UNAUTHORIZED"}, 401)
    operation = request.headers.get("X-Operation-Id", "")
    try:
        if str(uuid.UUID(operation)) != operation:
            raise ValueError()
    except ValueError:
        return extraction_response(None, {"errorCode": "INVALID_OPERATION"}, 400)
    kind = request.headers.get("X-Document-Type", "")
    if kind not in MIMES or request.mimetype != MIMES[kind]:
        return extraction_response(operation, {"errorCode": "UNSUPPORTED_FORMAT"}, 415)
    maximum = current_app.config["MAX_CONTENT_LENGTH"]
    try:
        # Raw bytes only. There is no URL, user id, Mongo id or authorization decision in the request.
        with tempfile.TemporaryDirectory(prefix="siare-extract-") as directory:
            path = os.path.join(directory, "source.bin")
            size = 0
            with open(path, "wb") as output:
                while chunk := request.stream.read(64 * 1024):
                    size += len(chunk)
                    if size > maximum:
                        raise RequestEntityTooLarge()
                    output.write(chunk)
            if size == 0:
                return extraction_response(operation, {"errorCode": "EMPTY_FILE"}, 400)
            payload = current_app.extensions["extraction_model"].extract(path, kind)
            status = 200 if "result" in payload else (503 if payload.get("errorCode") == "PROCESSOR_BUSY" else 422)
            return extraction_response(operation, payload, status)
    except RequestEntityTooLarge:
        return extraction_response(operation, {"errorCode": "FILE_TOO_LARGE"}, 413)
    except Exception:
        return extraction_response(operation, {"errorCode": "PROCESSING_ERROR"}, 500)
