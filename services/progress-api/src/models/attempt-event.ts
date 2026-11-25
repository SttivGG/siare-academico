export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const utcPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;
const idFields = ["eventId", "attemptId", "studentId", "subjectId", "activityId"] as const;
const eventFields = new Set<string>([
  ...idFields, "schemaVersion", "activityType", "eventType", "score", "durationMs", "occurredAt", "source",
]);

export interface AttemptEvent {
  schemaVersion: 1;
  eventId: string;
  attemptId: string;
  studentId: string;
  subjectId: string;
  activityId: string;
  activityType: "QUIZ" | "CROSSWORD";
  eventType: "ATTEMPT_EVALUATED";
  score: number;
  durationMs: number;
  occurredAt: string;
  source: "core-api";
}

export function parseAttemptEvent(input: unknown): AttemptEvent | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return;
  const event = input as Record<string, unknown>;
  if (Object.keys(event).length !== eventFields.size || Object.keys(event).some((key) => !eventFields.has(key))) return;
  if (!idFields.every((key) => typeof event[key] === "string" && uuidPattern.test(event[key]))) return;

  const { activityType, eventType, schemaVersion, score, durationMs, occurredAt, source } = event;
  if (schemaVersion !== 1 || (activityType !== "QUIZ" && activityType !== "CROSSWORD")) return;
  if (eventType !== "ATTEMPT_EVALUATED" || source !== "core-api") return;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) return;
  if (typeof durationMs !== "number" || !Number.isInteger(durationMs) || durationMs < 0 || durationMs > 86_400_000) return;
  if (typeof occurredAt !== "string") return;
  const instant = utcPattern.exec(occurredAt);
  if (!instant) return;
  const second = new Date(instant[1] + "Z");
  if (!Number.isFinite(second.getTime()) || second.toISOString() !== instant[1] + ".000Z") return;
  const fraction = instant[2]?.replace(/0+$/, "");
  return {
    schemaVersion,
    eventId: event.eventId as string,
    attemptId: event.attemptId as string,
    studentId: event.studentId as string,
    subjectId: event.subjectId as string,
    activityId: event.activityId as string,
    activityType,
    eventType,
    score,
    durationMs,
    occurredAt: instant[1] + (fraction ? "." + fraction : "") + "Z",
    source,
  };
}
