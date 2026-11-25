import { Router } from "express";
import { uuidPattern } from "../models/attempt-event.js";
import type { ProgressModel, ProgressScope } from "../models/progress.model.js";
import { authorizeInternalRequest, fail } from "./internal-request.js";

function uuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function encodeCursor(scope: ProgressScope, activityId: string) {
  return Buffer.from([scope.studentId, scope.subjectId, activityId].join(".")).toString("base64url");
}

function decodeCursor(cursor: unknown, scope: ProgressScope): string | undefined {
  if (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{147}$/.test(cursor)) return;
  const [studentId, subjectId, activityId] = Buffer.from(cursor, "base64url").toString("utf8").split(".");
  if (studentId !== scope.studentId || subjectId !== scope.subjectId || !uuid(activityId)) return;
  if (encodeCursor(scope, activityId) === cursor) return activityId;
}

export function progressRoutes(model: ProgressModel, token?: string) {
  const router = Router();
  router.get("/internal/v1/students/:studentId/progress", authorizeInternalRequest(token), async (request, response) => {
    const { studentId } = request.params;
    const { subjectId, limit = "20", cursor } = request.query;
    if (!uuid(studentId) || !uuid(subjectId) || typeof limit !== "string" || !/^(?:[1-9]\d?|100)$/.test(limit)) {
      return fail(response, 400, "VALIDATION", "Se requieren UUID válidos y un límite entre 1 y 100.");
    }
    const scope = { studentId, subjectId };
    const after = cursor === undefined ? undefined : decodeCursor(cursor, scope);
    if (cursor !== undefined && !after) {
      return fail(response, 400, "VALIDATION", "El cursor no es válido para este estudiante y materia.");
    }
    const pageSize = Number(limit);
    try {
      const rows = await model.list(scope, pageSize, after);
      const items = rows.slice(0, pageSize);
      response.json({
        schemaVersion: 1,
        requestId: response.locals.requestId,
        ...scope,
        items,
        nextCursor: rows.length > pageSize ? encodeCursor(scope, items[items.length - 1].activityId) : null,
        asOf: new Date().toISOString(),
      });
    } catch {
      console.warn("Progress query failed", { requestId: response.locals.requestId });
      return fail(response, 503, "DEPENDENCY_UNAVAILABLE", "No se pudo consultar el progreso.");
    }
  });
  return router;
}
