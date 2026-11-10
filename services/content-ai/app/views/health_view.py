from flask import jsonify


def health_response(ready: bool):
    return jsonify(service="content-ai", status="UP" if ready else "DOWN"), 200 if ready else 503
