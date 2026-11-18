import os
from flask import Flask

from app.controllers.health_controller import health_blueprint
from app.models.health import HealthModel, build_health_model
from app.controllers.extraction_controller import extraction_blueprint
from app.models.extraction_model import ExtractionModel


def create_app(health_model: HealthModel | None = None) -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("DOCUMENT_MAX_BYTES", "15728640"))
    app.config["CONTENT_SERVICE_TOKEN"] = os.environ.get("CONTENT_SERVICE_TOKEN", "")
    app.extensions["extraction_model"] = ExtractionModel()
    app.extensions["health_model"] = health_model if health_model is not None else build_health_model()
    app.register_blueprint(health_blueprint)
    app.register_blueprint(extraction_blueprint)
    return app
