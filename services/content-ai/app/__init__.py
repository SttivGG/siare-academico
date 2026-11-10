from flask import Flask

from app.controllers.health_controller import health_blueprint
from app.models.health import HealthModel, build_health_model


def create_app(health_model: HealthModel | None = None) -> Flask:
    app = Flask(__name__)
    app.extensions["health_model"] = health_model if health_model is not None else build_health_model()
    app.register_blueprint(health_blueprint)
    return app
