import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { json, Router } from "express";
import type { ErrorRequestHandler, Response } from "express";
import { parseAttemptEvent, uuidPattern } from "../models/attempt-event.js";
import type { AttemptModel } from "../models/attempt.model.js";

function fail(response: Response, status: number, code: string, message: string) {
  if (status === 503) response.set("Retry-After", "1");
  response.status(status).json({ requestId: response.locals.requestId, status, code, message });
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function attemptRoutes(model: AttemptModel, token?: string) {
  const router = Router();
  const tokenDigest = token && /^[!-~]{32,}$/.test(token) ? digest(token) : undefined;
  router.post("/internal/v1/attempts", (request, response, next) => {
    const id = request.get("X-Request-Id");
    const validId = id && uuidPattern.test(id);
    response.locals.requestId = validId ? id : randomUUID();
    response.set("Cache-Control", "no-store");

    if (!tokenDigest) return fail(response, 503, "DEPENDENCY_UNAVAILABLE", "Registro no disponible.");
    const credential = /^Bearer ([!-~]+)$/i.exec(request.get("Authorization") ?? "");
    if (!credential || !timingSafeEqual(tokenDigest, digest(credential[1]))) {
      response.set("WWW-Authenticate", "Bearer");
      return fail(response, 401, "UNAUTHORIZED", "Credencial de servicio inválida.");
    }
    if (!validId) return fail(response, 400, "VALIDATION", "X-Request-Id debe ser un UUID canónico.");
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
