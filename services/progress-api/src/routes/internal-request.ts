import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { RequestHandler, Response } from "express";
import { uuidPattern } from "../models/attempt-event.js";

export function fail(response: Response, status: number, code: string, message: string) {
  if (status === 503) response.set("Retry-After", "1");
  response.status(status).json({ requestId: response.locals.requestId, status, code, message });
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function authorizeInternalRequest(token?: string): RequestHandler {
  const tokenDigest = token && /^[!-~]{32,}$/.test(token) ? digest(token) : undefined;
  return (request, response, next) => {
    const id = request.get("X-Request-Id");
    const validId = id && uuidPattern.test(id);
    response.locals.requestId = validId ? id : randomUUID();
    response.set("Cache-Control", "no-store");

    if (!tokenDigest) return fail(response, 503, "DEPENDENCY_UNAVAILABLE", "Servicio interno no disponible.");
    const credential = /^Bearer ([!-~]+)$/i.exec(request.get("Authorization") ?? "");
    if (!credential || !timingSafeEqual(tokenDigest, digest(credential[1]))) {
      response.set("WWW-Authenticate", "Bearer");
      return fail(response, 401, "UNAUTHORIZED", "Credencial de servicio inválida.");
    }
    if (!validId) return fail(response, 400, "VALIDATION", "X-Request-Id debe ser un UUID canónico.");
    next();
  };
}
