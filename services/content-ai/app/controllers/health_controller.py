from flask import Blueprint, current_app

from app.views.health_view import health_response

health_blueprint = Blueprint("health", __name__)


@health_blueprint.get("/health")
def health():
    return health_response(current_app.extensions["health_model"].is_ready())
