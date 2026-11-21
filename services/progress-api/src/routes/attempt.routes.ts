import { json, Router } from "express";
import type { ErrorRequestHandler } from "express";
import { parseAttemptEvent } from "../models/attempt-event.js";
import type { AttemptModel } from "../models/attempt.model.js";
import { authorizeInternalRequest, fail } from "./internal-request.js";

export function attemptRoutes(model: AttemptModel, token?: string) {
  const router = Router();
  router.post("/internal/v1/attempts", authorizeInternalRequest(token), (request, response, next) => {
    if (!request.is("application/json")) {
      return fail(response, 415, "UNSUPPORTED_MEDIA_TYPE", "Se requiere application/json.");
    }
    next();
  }, json({ limit: "1mb", inflate: false }), async (request, response) => {
    if (request.body?.schemaVersion !== undefined && request.body.schemaVersion !== 1) {
      return fail(response, 400, "UNSUPPORTED_SCHEMA_VERSION", "La versión del evento debe ser 1.");
    }
    const event = parseAttemptEvent(request.body);
    if (!event || request.get("Idempotency-Key") !== event.eventId) {
      return fail(response, 400, "VALIDATION", "Evento inválido o Idempotency-Key diferente de eventId.");
    }

    const result = await model.record(event);
    switch (result.outcome) {
      case "idempotency-conflict":
        return fail(response, 409, "IDEMPOTENCY_CONFLICT", "El evento ya existe con otros datos.");
      case "attempt-conflict":
        return fail(response, 409, "ATTEMPT_CONFLICT", "El intento ya está registrado con otro evento.");
      default:
        response.status(result.outcome === "recorded" ? 201 : 200).json({
          schemaVersion: 1,
          requestId: response.locals.requestId,
          eventId: event.eventId,
          attemptId: event.attemptId,
          status: "RECORDED",
          recordedAt: result.recordedAt.toISOString(),
          analyticsStatus: "PENDING",
        });
    }
  });

  const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
    switch (error.type) {
      case "entity.too.large":
        return fail(response, 413, "PAYLOAD_TOO_LARGE", "El JSON supera 1 MiB.");
      case "entity.parse.failed":
        return fail(response, 400, "VALIDATION", "El JSON no es válido.");
      case "encoding.unsupported":
      case "charset.unsupported":
        return fail(response, 415, "UNSUPPORTED_MEDIA_TYPE", "Se requiere JSON UTF-8 sin compresión.");
      default:
        console.warn("Attempt recording failed", { requestId: response.locals.requestId });
        return fail(response, 503, "DEPENDENCY_UNAVAILABLE", "No se pudo confirmar el intento.");
    }
  };
  router.use(handleError);
  return router;
}
