// Run from the progress-api container. The token is read from its environment.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import cassandra from "cassandra-driver";

const [mode = "verify", seed = randomUUID()] = process.argv.slice(2);
assert.ok(mode === "verify" || mode === "replay");
const token = process.env.PROGRESS_SERVICE_TOKEN;
assert.ok(token, "Configure PROGRESS_SERVICE_TOKEN");

function testId(label) {
  const hex = createHash("sha256").update(seed + ":" + label).digest("hex");
  return hex.replace(/^(........)(....)(....)(....)(............).*$/, "$1-$2-$3-$4-$5");
}

const quiz = {
  schemaVersion: 1,
  eventId: testId("quiz-event"),
  attemptId: testId("quiz-attempt"),
  studentId: testId("student"),
  subjectId: testId("subject"),
  activityId: testId("quiz"),
  activityType: "QUIZ",
  eventType: "ATTEMPT_EVALUATED",
  score: 0.75,
  durationMs: 45000,
  occurredAt: "2026-11-18T19:00:00.123456Z",
  source: "core-api",
};
const crossword = {
  ...quiz,
  eventId: testId("crossword-event"),
  attemptId: testId("crossword-attempt"),
  activityId: testId("crossword"),
  activityType: "CROSSWORD",
};

async function send(event) {
  const requestId = randomUUID();
  const response = await fetch("http://127.0.0.1:3001/internal/v1/attempts", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      "Idempotency-Key": event.eventId,
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  assert.equal(body.requestId, requestId);
  return { status: response.status, body };
}

const client = new cassandra.Client({
  contactPoints: [process.env.CASSANDRA_HOST ?? "cassandra"],
  localDataCenter: process.env.CASSANDRA_DATACENTER ?? "datacenter1",
});
const asUuid = cassandra.types.Uuid.fromString;
try {
  if (mode === "verify") {
    const results = await Promise.all(Array.from({ length: 12 }, () => send(quiz)));
    assert.equal(results.filter(({ status }) => status === 201).length, 1, JSON.stringify(results));
    assert.equal(results.filter(({ status }) => status === 200).length, 11, JSON.stringify(results));
    assert.equal(new Set(results.map(({ body }) => body.recordedAt)).size, 1);
    for (const { body } of results) {
      assert.equal(body.attemptId, quiz.attemptId);
      assert.equal(body.eventId, quiz.eventId);
      assert.equal(body.analyticsStatus, "PENDING");
    }
    const eventConflict = await send({ ...quiz, attemptId: testId("other-attempt") });
    assert.equal(eventConflict.status, 409);
    assert.equal(eventConflict.body.code, "IDEMPOTENCY_CONFLICT");

    // Simulate the first Cassandra write being committed before Express stopped.
    const payload = JSON.stringify(crossword);
    const fingerprint = createHash("sha256").update(payload).digest("hex");
    await client.execute(
      "INSERT INTO siare_progress.event_claims (event_id, fingerprint) VALUES (?, ?) IF NOT EXISTS",
      [asUuid(crossword.eventId), fingerprint],
      { prepare: true },
    );
    assert.equal((await send(crossword)).status, 201);

    // An accepted Cassandra row without a progress receipt must be repaired on replay.
    const unconfirmed = {
      ...quiz, eventId: testId("unconfirmed-event"), attemptId: testId("unconfirmed-attempt"),
      studentId: testId("unconfirmed-student"),
    };
    const pendingPayload = JSON.stringify(unconfirmed);
    await client.execute(
      "INSERT INTO siare_progress.event_claims (event_id, fingerprint) VALUES (?, ?)",
      [asUuid(unconfirmed.eventId), createHash("sha256").update(pendingPayload).digest("hex")],
      { prepare: true },
    );
    await client.execute(
      "INSERT INTO siare_progress.attempts (attempt_id, event_id, payload, recorded_at) VALUES (?, ?, ?, ?)",
      [asUuid(unconfirmed.attemptId), asUuid(unconfirmed.eventId), pendingPayload, new Date()],
      { prepare: true },
    );
    assert.equal((await send(unconfirmed)).status, 200);
    const repaired = await client.execute(
      "SELECT progress_confirmed_at FROM siare_progress.attempts WHERE attempt_id = ?",
      [asUuid(unconfirmed.attemptId)],
      { prepare: true },
    );
    assert.ok(repaired.first().progress_confirmed_at instanceof Date);
    const response = await fetch(
      "http://127.0.0.1:3001/internal/v1/students/" + unconfirmed.studentId + "/progress?subjectId=" + unconfirmed.subjectId,
      { headers: { Authorization: "Bearer " + token, "X-Request-Id": randomUUID() }, signal: AbortSignal.timeout(15000) },
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).items[0].attemptCount, 1);
    console.log("OK: el reenvio reparo un intento duradero con progreso pendiente.");

    const competitors = ["a", "b"].map((label) => ({
      ...quiz, attemptId: testId("contested-attempt"), eventId: testId("contested-" + label),
    }));
    const race = await Promise.all(competitors.map(send));
    assert.deepEqual(race.map(({ status }) => status).sort(), [201, 409]);
    assert.equal(race.find(({ status }) => status === 409).body.code, "ATTEMPT_CONFLICT");
    const winner = race.find(({ status }) => status === 201).body.eventId;
    const losingEvent = competitors.find(({ eventId }) => eventId !== winner);
    const released = await client.execute(
      "SELECT event_id FROM siare_progress.event_claims WHERE event_id = ?",
      [asUuid(losingEvent.eventId)],
      { prepare: true },
    );
    assert.equal(released.rowLength, 0);
    console.log("OK: 12 envios concurrentes (1 x 201, 11 x 200), ambos conflictos y recuperacion de una reserva previa.");
  }
  for (const event of [quiz, crossword]) {
    const result = await client.execute(
      "SELECT event_id, payload, recorded_at FROM siare_progress.attempts WHERE attempt_id = ?",
      [asUuid(event.attemptId)],
      { prepare: true },
    );
    assert.equal(result.rowLength, 1);
    assert.equal(result.first().event_id.toString(), event.eventId);
    assert.deepEqual(JSON.parse(result.first().payload), event);
    const replay = await send(event);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.recordedAt, result.first().recorded_at.toISOString());
  }
  console.log("OK: Cassandra conserva un registro por intento y el mismo recordedAt al repetir. Modo: " + mode + ". Semilla: " + seed);
} finally {
  await client.shutdown();
}
