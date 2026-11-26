import json
import os
from flask import Flask

from app.controllers.health_controller import health_blueprint
from app.models.health import HealthModel, build_health_model
from app.controllers.extraction_controller import extraction_blueprint
from app.models.extraction_model import ExtractionModel


def create_app(health_model: HealthModel | None = None) -> Flask:
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__)

    # Set the maximum content length for incoming requests
    app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("DOCUMENT_MAX_BYTES", "15728640"))

    # Configure the content service token from environment variables
    app.config["CONTENT_SERVICE_TOKEN"] = os.environ.get("CONTENT_SERVICE_TOKEN", "")

    # Initialize the extraction and health models
    app.extensions["extraction_model"] = ExtractionModel()
    app.extensions["health_model"] = health_model if health_model is not None else build_health_model()

    # Register blueprints for health and extraction controllers
    app.register_blueprint(health_blueprint)
    app.register_blueprint(extraction_blueprint)

    app.config["LEARNING_SERVICE_TOKEN"] = os.environ.get("LEARNING_SERVICE_TOKEN", "")
    app.config["LEARNING_MAX_BYTES"] = int(os.environ.get("LEARNING_MAX_BYTES", "65536"))

    # Artefacto opcional. No se configura en Compose ni se modifica Docker.
    app.config["LEARNING_MODEL_PATH"] = os.environ.get("LEARNING_MODEL_PATH", "")

    # El registro carga modelos fuera de las solicitudes HTTP.
    from app.ml.inference.model_registry import ModelRegistry
    model_registry = ModelRegistry(app.config["LEARNING_MODEL_PATH"] or None)
    if app.config["LEARNING_MODEL_PATH"]:
        try:
            model_registry.load_artifact()
        except (OSError, json.JSONDecodeError, ValueError):
            app.logger.error("No se pudo cargar el artefacto ML; se conservará el baseline.")
    app.extensions["learning_model_registry"] = model_registry

    from app.controllers.learning_controller import learning_blueprint
    app.register_blueprint(learning_blueprint)

    app.config["GEMINI_MODEL"] = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    app.config["GEMINI_TIMEOUT_SECONDS"] = float(os.environ.get("GEMINI_TIMEOUT_SECONDS", "30"))
    app.config["GEMINI_MAX_RETRIES"] = int(os.environ.get("GEMINI_MAX_RETRIES", "2"))
    app.config["GEMINI_MAX_INPUT_CHARS"] = int(os.environ.get("GEMINI_MAX_INPUT_CHARS", "100000"))
    app.config["GEMINI_MAX_QUESTIONS"] = int(os.environ.get("GEMINI_MAX_QUESTIONS", "20"))
    app.config["GEMINI_MAX_REQUESTS_PER_MINUTE"] = int(os.environ.get("GEMINI_MAX_REQUESTS_PER_MINUTE", "30"))
    app.config["GEMINI_MAX_REQUEST_BYTES"] = int(os.environ.get("GEMINI_MAX_REQUEST_BYTES", "131072"))

    # Gemini es opcional: una clave ausente no deshabilita OCR, salud o ML local.
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            from app.generative.gemini_service import GeminiService
            app.extensions["gemini_service"] = GeminiService(
                api_key=api_key,
                model=app.config["GEMINI_MODEL"],
                timeout_seconds=app.config["GEMINI_TIMEOUT_SECONDS"],
                max_retries=app.config["GEMINI_MAX_RETRIES"],
                max_input_chars=app.config["GEMINI_MAX_INPUT_CHARS"],
                max_requests_per_minute=app.config["GEMINI_MAX_REQUESTS_PER_MINUTE"],
            )
        except (ImportError, ValueError, RuntimeError):
            app.extensions.pop("gemini_service", None)
            app.logger.error("Gemini no pudo inicializarse; los endpoints generativos quedarán no disponibles.")

    from app.controllers.generative_learning_controller import generative_learning_blueprint
    app.register_blueprint(generative_learning_blueprint)

    return app
