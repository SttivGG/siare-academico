import logging
import os
from collections.abc import Callable

from pymongo import MongoClient
from redis import Redis

logger = logging.getLogger(__name__)


class HealthModel:
    def __init__(self, probes: dict[str, Callable[[], object]]) -> None:
        self.probes = probes

    def is_ready(self) -> bool:
        ready = True
        for name, probe in self.probes.items():
            try:
                probe()
            except Exception:
                # Do not log connection strings or credentials.
                logger.warning("Readiness check failed: %s", name)
                ready = False
        return ready


def build_health_model() -> HealthModel:
    database = os.environ["MONGO_DATABASE"]
    mongo = MongoClient(
        host=os.environ.get("MONGO_HOST", "mongo"),
        port=27017,
        username=os.environ["MONGO_USER"],
        password=os.environ["MONGO_PASSWORD"],
        authSource=database,
        serverSelectionTimeoutMS=2000,
        connectTimeoutMS=2000,
        socketTimeoutMS=2000,
        maxPoolSize=5,
        connect=False,
    )
    redis = Redis(
        host=os.environ.get("REDIS_HOST", "redis"),
        port=6379,
        password=os.environ["REDIS_PASSWORD"],
        socket_connect_timeout=2,
        socket_timeout=2,
        max_connections=5,
    )
    return HealthModel({"mongo": lambda: mongo[database].command("ping"), "redis": redis.ping})
