import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import cassandra from "cassandra-driver";
import { createClickHouseAnalytics } from "./dist/models/analytics.model.js";

const [mode, seed] = process.argv.slice(2);
assert.ok((mode === "outage" || mode === "recover") && seed, "Use outage/recover with the same seed");
const token = process.env.PROGRESS_SERVICE_TOKEN;
assert.ok(token, "Configure the local progress token");

function id(label) {
  const hash = createHash("sha256").update(seed + ":" + label).digest("hex");
  return hash.replace(/^(........)(....)(....)(....)(............).*$/, "$1-$2-$3-$4-$5");
}

const studentId = id("student"), subjectId = id("subject");
const from = "2026-11-18T00:00:00.000Z", to = "2026-11-19T00:00:00.000Z";
const query = "/internal/v1/students/" + studentId + "/indicators?subjectId=" + subjectId + "&from=" + from + "&to=" + to;
const templates = [
  { label: "start", score: 0.8, durationMs: 40000, occurredAt: from },
  { label: "inside", score: 0.6, durationMs: 60000, occurredAt: "2026-11-18T21:00:00.123456Z" },
  { label: "excluded", score: 0.4, durationMs: 20000, occurredAt: to },
  { label: "other-scope", studentId: id("other-student"), score: 0.1, durationMs: 6000, occurredAt: from },
];
const events = templates.map(({ label, studentId: student = studentId, ...values }) => ({
  schemaVersion: 1,
  eventId: id(label + "-event"),
  attemptId: id(label + "-attempt"),
  studentId: student,
  subjectId,
  activityId: id("quiz"),
  activityType: "QUIZ",
  eventType: "ATTEMPT_EVALUATED",
  ...values,
  source: "core-api",
}));

async function request(path, options = {}) {
  const requestId = randomUUID();
  const response = await fetch("http://127.0.0.1:3001" + path, {
    ...options,
    headers: { Authorization: "Bearer " + token, "X-Request-Id": requestId, ...options.headers },
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  assert.equal(body.requestId, requestId);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  return { status: response.status, body };
}

const client = new cassandra.Client({
  contactPoints: [process.env.CASSANDRA_HOST ?? "cassandra"],
  localDataCenter: process.env.CASSANDRA_DATACENTER ?? "datacenter1",
});

async function readAttempt(event) {
  const result = await client.execute(
    "SELECT recorded_at, analytics_confirmed_at FROM siare_progress.attempts WHERE attempt_id = ?",
    [cassandra.types.Uuid.fromString(event.attemptId)],
    { prepare: true },
  );
  assert.equal(result.rowLength, 1);
  return result.first();
}

function measure(response) {
  assert.equal(response.status, 200, JSON.stringify(response));
  const { attemptCount, averageScore, totalDurationMs, asOf, ingestionLagMs } = response.body;
  return { attemptCount, averageScore, totalDurationMs, asOf, ingestionLagMs };
}

try {
  if (mode === "outage") {
    for (const event of events) {
      const result = await request("/internal/v1/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": event.eventId },
        body: JSON.stringify(event),
      });
      assert.equal(result.status, 201, JSON.stringify(result));
      assert.equal(result.body.analyticsStatus, "PENDING");
    }
    const unavailable = await request(query);
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.body.code, "DEPENDENCY_UNAVAILABLE");
    for (const event of events) assert.equal((await readAttempt(event)).analytics_confirmed_at, null);
    console.log("OK: Express guardó cuatro intentos durante el fallo de ClickHouse y mantuvo pendiente su entrega.");
  } else {
    let outcome;
    for (let attempt = 0; attempt < 30; attempt++) {
      const confirmations = await Promise.all(events.map(readAttempt));
      if (confirmations.every((row) => row.analytics_confirmed_at instanceof Date)) {
        outcome = measure(await request(query));
        break;
      }
      await setTimeout(1000);
    }
    assert.ok(outcome, "La entrega no confirmó los intentos pendientes");
    assert.equal(outcome.attemptCount, 2);
    assert.equal(outcome.averageScore, 0.7);
    assert.equal(outcome.totalDurationMs, 100000);
    assert.ok(Number.isFinite(Date.parse(outcome.asOf)));
    assert.ok(Number.isSafeInteger(outcome.ingestionLagMs) && outcome.ingestionLagMs >= 0);
    const empty = measure(await request(query.replace(subjectId, id("empty"))));
    assert.deepEqual(empty, { attemptCount: 0, averageScore: null, totalDurationMs: 0, asOf: null, ingestionLagMs: null });
    assert.equal((await request(query.replace(to, "2027-01-01T00:00:00Z"))).status, 400);
    assert.equal((await request(query.replace(from, "2026-11-31T00:00:00Z"))).status, 400);
    assert.equal((await request(query, { headers: { Authorization: "Bearer invalid" } })).status, 401);

    const clickhouse = createClickHouseAnalytics({
      url: process.env.CLICKHOUSE_URL, username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD, database: process.env.CLICKHOUSE_DB,
    });
    const repeat = { event: events[0], recordedAt: (await readAttempt(events[0])).recorded_at };
    await clickhouse.insert([repeat]);
    const sqlUrl = new URL(process.env.CLICKHOUSE_URL);
    sqlUrl.searchParams.set("database", process.env.CLICKHOUSE_DB);
    sqlUrl.searchParams.set("param_event", events[0].eventId);
    const physicalRows = await fetch(sqlUrl, {
      method: "POST",
      body: "SELECT count() FROM academic_events WHERE event_id = {event:UUID} FORMAT TabSeparated",
      headers: { "X-ClickHouse-User": process.env.CLICKHOUSE_USER, "X-ClickHouse-Key": process.env.CLICKHOUSE_PASSWORD },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(physicalRows.status, 200);
    assert.ok(Number(await physicalRows.text()) >= 2);
    assert.deepEqual(measure(await request(query)), outcome);
    console.log("OK: recuperación, rango UTC, alcance y duplicado real. Resultado: " + JSON.stringify(outcome));
  }
} finally {
  await client.shutdown();
}
