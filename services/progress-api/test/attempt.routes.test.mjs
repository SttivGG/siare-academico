import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

const token = "test-only-progress-service-token-0000";
const fixture = {
  schemaVersion: 1,
  eventId: randomUUID(),
  attemptId: randomUUID(),
  studentId: randomUUID(),
  subjectId: randomUUID(),
  activityId: randomUUID(),
  activityType: "QUIZ",
  eventType: "ATTEMPT_EVALUATED",
  score: 0.7,
  durationMs: 45000,
  occurredAt: "2026-11-18T19:00:00.123456000Z",
  source: "core-api",
};

async function withApp(record, exercise, configuredToken = token) {
  const server = createApp({ isReady: async () => true }, {
    model: { record },
    token: configuredToken,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    await exercise((body = fixture, headers = {}) => fetch(url + "/internal/v1/attempts", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "X-Request-Id": randomUUID(),
        "Idempotency-Key": fixture.eventId,
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("maps Cassandra outcomes to the attempt contract and preserves timestamp precision", async () => {
  const recordedAt = new Date("2026-11-18T19:01:00.000Z");
  const requestId = randomUUID();
  const outcomes = [
    [{ outcome: "recorded", recordedAt }, 201],
    [{ outcome: "duplicate", recordedAt }, 200],
    [{ outcome: "idempotency-conflict" }, 409, "IDEMPOTENCY_CONFLICT"],
    [{ outcome: "attempt-conflict" }, 409, "ATTEMPT_CONFLICT"],
  ];
  let index = 0;
  await withApp(async (event) => {
    assert.deepEqual(event, { ...fixture, occurredAt: "2026-11-18T19:00:00.123456Z" });
    return outcomes[index++][0];
  }, async (send) => {
    for (const [, status, errorCode] of outcomes) {
      const response = await send(fixture, { "X-Request-Id": requestId });
      const body = await response.json();
      assert.equal(response.status, status);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(body.requestId, requestId);
      if (errorCode) {
        assert.equal(body.code, errorCode);
      } else {
        assert.deepEqual(body, {
          schemaVersion: 1, requestId, eventId: fixture.eventId, attemptId: fixture.attemptId,
          status: "RECORDED", recordedAt: recordedAt.toISOString(), analyticsStatus: "PENDING",
        });
      }
    }
  });
});

test("checks service authentication, headers and payload before recording", async () => {
  await withApp(async () => assert.fail("invalid requests must never reach Cassandra"), async (send) => {
    const cases = [
      [fixture, { Authorization: "Bearer invalid" }, 401, "UNAUTHORIZED"],
      [fixture, { "X-Request-Id": "invalid" }, 400, "VALIDATION"],
      [fixture, { "Idempotency-Key": randomUUID() }, 400, "VALIDATION"],
      [fixture, { "Content-Type": "text/plain" }, 415, "UNSUPPORTED_MEDIA_TYPE"],
      [{ ...fixture, schemaVersion: 2 }, {}, 400, "UNSUPPORTED_SCHEMA_VERSION"],
      [{ ...fixture, score: "0.7" }, {}, 400, "VALIDATION"],
      [{ ...fixture, occurredAt: "2026-02-30T19:00:00Z" }, {}, 400, "VALIDATION"],
      [{ ...fixture, answers: ["private"] }, {}, 400, "VALIDATION"],
      ["{", {}, 400, "VALIDATION"],
      [JSON.stringify({ value: "x".repeat(1024 * 1024) }), {}, 413, "PAYLOAD_TOO_LARGE"],
    ];
    for (const [body, headers, status, code] of cases) {
      const result = await send(body, headers);
      assert.equal(result.status, status, code);
      assert.equal((await result.json()).code, code);
    }
  });
  await withApp(async () => assert.fail("no configured service token"), async (send) => {
    assert.equal((await send()).status, 503);
  }, "");
});

test("an unconfirmed Cassandra write returns a sanitized retryable error", async () => {
  await withApp(async () => { throw new Error("example connection details"); }, async (send) => {
    const response = await send();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "1");
    const body = await response.json();
    assert.equal(body.code, "DEPENDENCY_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(body), /connection details/);
  });
});
