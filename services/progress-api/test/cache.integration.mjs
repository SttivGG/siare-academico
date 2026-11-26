// Run inside the local progress-api container with the short TTL or outage override.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

const mode = process.argv[2];
assert.ok(mode === "warm" || mode === "outage");
const token = process.env.PROGRESS_SERVICE_TOKEN;
assert.ok(token, "Missing the local service token");
const studentId = randomUUID();
const subjectId = randomUUID();
const activityId = randomUUID();
const progressPath = "/internal/v1/students/" + studentId + "/progress?subjectId=" + subjectId;
const indicatorsPath = "/internal/v1/students/" + studentId + "/indicators?subjectId=" + subjectId
  + "&from=2026-11-18T00:00:00Z&to=2026-11-19T00:00:00Z";

async function request(path, options = {}, expected = 200) {
  const requestId = randomUUID();
  const response = await fetch("http://127.0.0.1:3001" + path, {
    ...options,
    headers: { Authorization: "Bearer " + token, "X-Request-Id": requestId, ...options.headers },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  assert.equal(response.status, expected, JSON.stringify(body));
  assert.equal(body.requestId, requestId);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  return body;
}

const metrics = () => request("/internal/v1/cache/metrics");

function record(score) {
  const eventId = randomUUID();
  return request("/internal/v1/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": eventId },
    body: JSON.stringify({
      schemaVersion: 1, eventId, attemptId: randomUUID(), studentId, subjectId, activityId,
      activityType: "QUIZ", eventType: "ATTEMPT_EVALUATED", score, durationMs: 45000,
      occurredAt: "2026-11-18T19:00:00Z", source: "core-api",
    }),
  }, 201);
}

async function indicatorsEventually(count) {
  for (let index = 0; index < 30; index++) {
    const body = await request(indicatorsPath);
    if (body.attemptCount === count) return body;
    await setTimeout(300);
  }
  assert.fail("The indicators did not reflect the confirmed ingestion in time");
}

if (mode === "warm") {
  let baseline = await metrics();
  for (let index = 0; !baseline.redisReady && index < 20; index++) {
    await setTimeout(250);
    baseline = await metrics();
  }
  assert.equal(baseline.redisReady, true);
  assert.ok(baseline.ttlSeconds <= 8, "Use the short TTL override for this test");
  for (let round = 0; round < 2; round++) {
    assert.deepEqual((await request(progressPath)).items, []);
    assert.equal((await request(indicatorsPath)).attemptCount, 0);
  }
  const warmed = await metrics();
  for (const kind of ["progress", "indicators"]) {
    assert.ok(warmed[kind].misses > baseline[kind].misses);
    assert.ok(warmed[kind].hits > baseline[kind].hits);
  }
  await record(0.8);
  assert.equal((await request(progressPath)).items[0].attemptCount, 1);
  assert.equal((await indicatorsEventually(1)).averageScore, 0.8);
  const fresh = await metrics();
  assert.ok(fresh.progress.invalidations > baseline.progress.invalidations);
  assert.ok(fresh.indicators.invalidations > baseline.indicators.invalidations);

  await setTimeout((fresh.ttlSeconds + 1) * 1000);
  assert.equal((await request(progressPath)).items[0].attemptCount, 1);
  assert.equal((await request(indicatorsPath)).attemptCount, 1);
  const expired = await metrics();
  assert.ok(expired.progress.misses > fresh.progress.misses);
  assert.ok(expired.indicators.misses > fresh.indicators.misses);
  console.log("OK: Redis real; hits, misses, invalidacion por registro e ingesta, y vencimiento en ambas vistas.");
  console.log(JSON.stringify({
    ttlSeconds: expired.ttlSeconds,
    progress: expired.progress,
    indicators: expired.indicators,
  }));
} else {
  const baseline = await metrics();
  assert.equal(baseline.redisReady, false);
  await record(0.6);
  assert.equal((await request(progressPath)).items[0].bestScore, 0.6);
  assert.equal((await indicatorsEventually(1)).totalDurationMs, 45000);
  const fallback = await metrics();
  assert.ok(fallback.progress.fallbacks > baseline.progress.fallbacks);
  assert.ok(fallback.indicators.fallbacks > baseline.indicators.fallbacks);
  console.log("OK: Redis inaccesible; registro y ambas consultas operaron con Cassandra y ClickHouse.");
}
