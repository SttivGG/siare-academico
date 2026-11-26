"""Capa aislada de comunicación con Gemini.

Esta clase centraliza el SDK, timeout, reintentos, JSON estricto y límites.
Ningún controlador Flask expone la clave, recibe prompts libres ni ejecuta salida.
"""

import os
import re
import time
from collections import deque
from threading import Lock

from google import genai
from google.genai import types


class GeminiUnavailableError(RuntimeError):
    """Error técnico normalizado para fallos externos de Gemini."""


class GeminiService:
    """Cliente reutilizable para operaciones educativas con Gemini."""

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: float,
        max_retries: int,
        max_input_chars: int,
        max_requests_per_minute: int,
    ):
        if not api_key:
            raise GeminiUnavailableError("GEMINI_API_KEY no está configurada")
        if max_retries < 0 or max_retries > 3:
            raise ValueError("GEMINI_MAX_RETRIES debe estar entre 0 y 3")
        if timeout_seconds < 1 or timeout_seconds > 120:
            raise ValueError("GEMINI_TIMEOUT_SECONDS debe estar entre 1 y 120")

        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.max_input_chars = max_input_chars
        self.max_requests_per_minute = max_requests_per_minute
        self._lock = Lock()
        self._timestamps: deque[float] = deque()

        # El cliente se reutiliza durante toda la vida del proceso Flask.
        self._client = genai.Client(api_key=api_key)

    @classmethod
    def from_environment(cls) -> "GeminiService":
        """Construye el servicio desde variables de entorno, sin secretos en archivos."""
        return cls(
            api_key=os.environ.get("GEMINI_API_KEY", ""),
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
            timeout_seconds=float(os.environ.get("GEMINI_TIMEOUT_SECONDS", "30")),
            max_retries=int(os.environ.get("GEMINI_MAX_RETRIES", "2")),
            max_input_chars=int(os.environ.get("GEMINI_MAX_INPUT_CHARS", "100000")),
            max_requests_per_minute=int(os.environ.get("GEMINI_MAX_REQUESTS_PER_MINUTE", "30")),
        )

    def _wait_for_quota(self) -> None:
        """Impide exceder la cuota interna por minuto mediante una ventana móvil."""
        with self._lock:
            now = time.monotonic()
            while self._timestamps and now - self._timestamps[0] >= 60:
                self._timestamps.popleft()
            if len(self._timestamps) >= self.max_requests_per_minute:
                raise GeminiUnavailableError("RATE_LIMITED")
            self._timestamps.append(now)

    def generate_json(self, prompt: str) -> str:
        """Solicita JSON, valida longitud y reintenta solo ante fallos seguros."""
        if not isinstance(prompt, str) or not prompt.strip():
            raise GeminiUnavailableError("Prompt inválido")
        if len(prompt) > self.max_input_chars:
            raise GeminiUnavailableError("PAYLOAD_TOO_LARGE")

        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                self._wait_for_quota()
                response = self._client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                        http_options=types.HttpOptions(timeout=int(self.timeout_seconds * 1000)),
                    ),
                )
                text = getattr(response, "text", None)
                if not isinstance(text, str) or not text.strip():
                    raise GeminiUnavailableError("EMPTY_RESPONSE")

                cleaned = text.strip()
                cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
                cleaned = re.sub(r"\s*```$", "", cleaned)
                if not cleaned:
                    raise GeminiUnavailableError("EMPTY_RESPONSE")
                return cleaned

            except GeminiUnavailableError:
                raise
            except Exception as error:
                last_error = error
                status = getattr(error, "status_code", None)
                if status is None:
                    status = getattr(error, "code", None)

                name = type(error).__name__
                if status in {401, 403}:
                    raise GeminiUnavailableError("GEMINI_AUTH_ERROR")
                if status == 429:
                    raise GeminiUnavailableError("RATE_LIMITED")
                if status == 404:
                    raise GeminiUnavailableError("GEMINI_MODEL_NOT_FOUND")
                if name in {"TimeoutError", "TimeoutException", "APITimeoutError"}:
                    raise GeminiUnavailableError("GEMINI_TIMEOUT")
                if attempt >= self.max_retries:
                    break

        if last_error is not None:
            # No se registra ni devuelve la excepción original, porque puede
            # contener URL, payload, cabeceras o información de la clave.
            raise GeminiUnavailableError("GEMINI_API_ERROR")
        raise GeminiUnavailableError("GEMINI_API_ERROR")
