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

    return app
