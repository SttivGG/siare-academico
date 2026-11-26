import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const origin = "http://127.0.0.1:3001";
const token = process.env.PROGRESS_SERVICE_TOKEN;
assert.ok(token, "Configure PROGRESS_SERVICE_TOKEN");
const studentId = randomUUID();
const subjectId = randomUUID();
const firstId = "1" + "0".repeat(7) + "-0000-4000-8000-" + randomUUID().slice(-12);
const secondId = "1" + "f".repeat(7) + "-0000-4000-8000-" + randomUUID().slice(-12);
const thirdId = "e" + randomUUID().slice(1);
const tiedAttemptId = "f" + randomUUID().slice(1);
const original = {
  schemaVersion: 1,
  eventId: randomUUID(),
  attemptId: randomUUID(),
  studentId,
  subjectId,
  activityId: firstId,
  activityType: "QUIZ",
  eventType: "ATTEMPT_EVALUATED",
  score: 0.8,
  durationMs: 45000,
  occurredAt: "2026-11-18T19:00:00Z",
  source: "core-api",
};

function attempt(fields) {
  return { ...original, eventId: randomUUID(), attemptId: randomUUID(), ...fields };
}

async function request(path, options = {}) {
  const requestId = randomUUID();
  const response = await fetch(origin + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "X-Request-Id": requestId,
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  assert.equal(body.requestId, requestId);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  return { status: response.status, body };
}

async function record(event, expected = 201) {
  const result = await request("/internal/v1/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": event.eventId },
    body: JSON.stringify(event),
  });
  assert.equal(result.status, expected, JSON.stringify(result));
}

function progressPath(student = studentId, subject = subjectId, query = "") {
  return "/internal/v1/students/" + student + "/progress?subjectId=" + subject + query;
}

async function progress(student, subject, query) {
  const result = await request(progressPath(student, subject, query));
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.body.studentId, student ?? studentId);
  assert.equal(result.body.subjectId, subject ?? subjectId);
  assert.equal(result.body.schemaVersion, 1);
  assert.ok(Number.isFinite(Date.parse(result.body.asOf)));
  return result.body;
}

const empty = await progress();
assert.deepEqual(empty.items, []);
assert.equal(empty.nextCursor, null);

const newer = attempt({
  attemptId: "0" + randomUUID().slice(1),
  score: 0.6,
  occurredAt: "2026-11-18T19:00:00.000000001Z",
});
await record(newer);
await record(original); // Arrival order does not decide which attempt is latest.
await record(newer, 200);
assert.deepEqual((await progress()).items, [{
  activityId: firstId, attemptCount: 2, bestScore: 0.8, lastScore: 0.6,
  lastAttemptAt: newer.occurredAt,
}]);

await record(attempt({ attemptId: tiedAttemptId, score: 0.5, occurredAt: newer.occurredAt }));
const others = Array.from({ length: 6 }, (_, index) => attempt({
  activityId: secondId,
  score: index / 10,
  occurredAt: "2026-11-18T19:00:0" + index + "Z",
}));
await Promise.all(others.map((event) => record(event)));
await record(attempt({ activityId: thirdId }));
const otherStudent = randomUUID();
const otherSubject = randomUUID();
await record(attempt({ studentId: otherStudent, activityId: thirdId }));
await record(attempt({ subjectId: otherSubject, activityId: thirdId }));

const first = await progress(undefined, undefined, "&limit=1");
assert.deepEqual(first.items, [{
  activityId: firstId, attemptCount: 3, bestScore: 0.8, lastScore: 0.5,
  lastAttemptAt: newer.occurredAt,
}]);
assert.ok(first.nextCursor);
const second = await progress(undefined, undefined, "&limit=1&cursor=" + first.nextCursor);
assert.deepEqual(second.items, [{
  activityId: secondId, attemptCount: 6, bestScore: 0.5, lastScore: 0.5,
  lastAttemptAt: "2026-11-18T19:00:05Z",
}]);
assert.ok(second.nextCursor);
const third = await progress(undefined, undefined, "&limit=1&cursor=" + second.nextCursor);
assert.deepEqual(third.items.map(({ activityId }) => activityId), [thirdId]);
assert.equal(third.nextCursor, null);

// An item inserted behind the cursor belongs to a fresh traversal only.
const behindCursor = "0" + randomUUID().slice(1);
const aheadOfCursor = "8" + randomUUID().slice(1);
await record(attempt({ activityId: behindCursor }));
await record(attempt({ activityId: aheadOfCursor }));
assert.deepEqual((await progress(undefined, undefined, "&cursor=" + second.nextCursor))
  .items.map(({ activityId }) => activityId), [aheadOfCursor, thirdId]);
assert.deepEqual((await progress()).items.map(({ activityId }) => activityId),
  [behindCursor, firstId, secondId, aheadOfCursor, thirdId]);
assert.deepEqual((await progress(otherStudent)).items.map(({ activityId }) => activityId), [thirdId]);
assert.deepEqual((await progress(undefined, otherSubject)).items.map(({ activityId }) => activityId), [thirdId]);

for (const path of [
  progressPath(otherStudent, subjectId, "&cursor=" + first.nextCursor),
  progressPath(studentId, otherSubject, "&cursor=" + first.nextCursor),
  progressPath(studentId, subjectId, "&cursor=invalid"),
  progressPath(studentId, subjectId, "&limit=0"),
  progressPath(studentId, subjectId, "&limit=101"),
  progressPath(studentId, subjectId, "&limit=1&limit=2"),
  progressPath("invalid"),
]) {
  assert.equal((await request(path)).status, 400, path);
}
assert.equal((await request(progressPath(), { headers: { Authorization: "Bearer invalid" } })).status, 401);
console.log("OK: progreso vacío, reintentos, notas, orden temporal, desempate, concurrencia, tres páginas y aislamiento.");
