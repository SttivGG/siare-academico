import unittest

from app import create_app
from app.models.health import HealthModel


class HealthTests(unittest.TestCase):
    def test_readiness_success_and_method_restriction(self):
        client = create_app(HealthModel({"mongo": lambda: True, "redis": lambda: True})).test_client()
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"service": "content-ai", "status": "UP"})
        self.assertEqual(client.post("/health").status_code, 405)

    def test_failure_does_not_disclose_credentials(self):
        def unavailable():
            raise ConnectionError("sensitive connection details")

        client = create_app(HealthModel({"mongo": unavailable})).test_client()
        response = client.get("/health")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json, {"service": "content-ai", "status": "DOWN"})
        self.assertNotIn(b"sensitive", response.data)


if __name__ == "__main__":
    unittest.main()
