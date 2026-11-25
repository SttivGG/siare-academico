import { Router } from "express";
import { uuidPattern } from "../models/attempt-event.js";
import type { AnalyticsReader } from "../models/analytics.model.js";
import { authorizeInternalRequest, fail } from "./internal-request.js";

const maxIntervalMs = 31 * 86_400_000;
const millisUtc = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/;

function parseInstant(value: unknown) {
  const parts = typeof value === "string" ? millisUtc.exec(value) : null;
  if (!parts) return;
  const normalized = parts[1] + "." + (parts[2] ?? "").padEnd(3, "0") + "Z";
  const date = new Date(normalized);
  if (date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 2299 && date.toISOString() === normalized) return date;
}

export function analyticsRoutes(model?: AnalyticsReader, token?: string) {
  const router = Router();
  router.get("/internal/v1/students/:studentId/indicators", authorizeInternalRequest(token), async (request, response) => {
    const { studentId } = request.params;
    const { subjectId } = request.query;
    const from = parseInstant(request.query.from);
    const to = parseInstant(request.query.to);
    if (typeof studentId !== "string" || !uuidPattern.test(studentId) || typeof subjectId !== "string" || !uuidPattern.test(subjectId)
        || !from || !to || from >= to || to.getTime() - from.getTime() > maxIntervalMs) {
      return fail(response, 400, "VALIDATION", "Se requieren UUID y un intervalo UTC válido de hasta 31 días.");
    }
    if (!model) return fail(response, 503, "DEPENDENCY_UNAVAILABLE", "Indicadores no disponibles.");
    try {
      const indicators = await model.indicators({ studentId, subjectId, from, to });
      response.json({
        schemaVersion: 1,
        requestId: response.locals.requestId,
        studentId,
        subjectId,
        from: from.toISOString(),
        to: to.toISOString(),
        ...indicators,
      });
    } catch {
      console.warn("Analytics query failed", { requestId: response.locals.requestId });
      return fail(response, 503, "DEPENDENCY_UNAVAILABLE", "No se pudieron consultar los indicadores.");
    }
  });
  return router;
}
