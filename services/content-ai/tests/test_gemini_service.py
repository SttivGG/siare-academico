"""Pruebas del cliente Gemini sin realizar llamadas externas.

Todas las instancias de cliente se reemplazan mediante mocks del SDK oficial.
"""

import unittest
from unittest.mock import patch

from app.generative.gemini_service import GeminiService, GeminiUnavailableError


class GeminiServiceTests(unittest.TestCase):
    @patch("app.generative.gemini_service.genai.Client")
    def test_empty_response_is_normalized(self, client_type):
        """Una respuesta sin texto se convierte en EMPTY_RESPONSE."""
        client = client_type.return_value
        client.models.generate_content.return_value.text = ""
        service = GeminiService("" if False else "synthetic" * 5,
                               "gemini-test", 5.0, 0, 100000, 30)
        with self.assertRaises(GeminiUnavailableError) as error:
            service.generate_json("Prompt sintético")
        self.assertEqual(str(error.exception), "EMPTY_RESPONSE")

    @patch("app.generative.gemini_service.genai.Client")
    def test_api_exception_is_normalized(self, client_type):
        """Una excepción SDK no expone detalles ni se reintenta más del límite."""
        client_type.return_value.models.generate_content.side_effect = RuntimeError("detalles privados")
        service = GeminiService("synthetic" * 5, "gemini-test", 5.0, 1, 100000, 30)
        with self.assertRaises(GeminiUnavailableError) as error:
            service.generate_json("Prompt sintético")
        self.assertEqual(str(error.exception), "GEMINI_API_ERROR")

    def test_payload_too_large_is_rejected(self):
        """Rechaza entrada antes de crear una llamada Gemini."""
        service = GeminiService("synthetic" * 5, "gemini-test", 5.0, 0, 10, 30)
        with self.assertRaises(GeminiUnavailableError) as error:
            service.generate_json("Un prompt mucho más largo")
        self.assertEqual(str(error.exception), "PAYLOAD_TOO_LARGE")


if __name__ == "__main__":
    unittest.main()
