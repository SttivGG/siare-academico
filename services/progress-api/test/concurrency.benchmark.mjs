// Run inside the local SIARE progress-api container via node --input-type=module -.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { setTimeout } from "node:timers/promises";

const [sizeArg = "20", roundsArg = "2"] = process.argv.slice(2);
const requests = Number(sizeArg);
const rounds = Number(roundsArg);
assert.ok(Number.isInteger(requests) && requests >= 20 && requests <= 100, "Use 20 to 100 requests per case");
assert.ok(Number.isInteger(rounds) && rounds >= 2 && rounds <= 5, "Use 2 to 5 rounds");

const token = process.env.PROGRESS_SERVICE_TOKEN;
assert.ok(token, "Run inside progress-api with its service credential configured");
const clockTicks = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).trim());
const origin = "http://127.0.0.1:3001";
const from = "2026-11-18T00:00:00Z";
const to = "2026-11-19T00:00:00Z";
const levelSet = [1, 5, 10, 20];

function fixture() {
  return { studentId: randomUUID(), subjectId: randomUUID(), activityId: randomUUID() };
}

function event(scope, index) {
  return {
    schemaVersion: 1, eventId: randomUUID(), attemptId: randomUUID(), ...scope,
    activityType: "QUIZ", eventType: "ATTEMPT_EVALUATED",
    score: (index % 11) / 10, durationMs: 1000 + index,
    occurredAt: new Date(Date.parse(from) + index * 1000).toISOString(), source: "core-api",
  };
}

function paths({ studentId, subjectId }) {
  const base = "/internal/v1/students/" + studentId;
  return {
    progress: base + "/progress?subjectId=" + subjectId,
    indicators: base + "/indicators?subjectId=" + subjectId + "&from=" + from + "&to=" + to,
  };
}

async function call(path, attempt) {
  const id = randomUUID();
  const response = await fetch(origin + path, {
    method: attempt ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      "X-Request-Id": id,
      ...(attempt ? { "Idempotency-Key": attempt.eventId, "Content-Type": "application/json" } : {}),
    },
    body: attempt ? JSON.stringify(attempt) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  assert.equal(body.requestId, id);
  return { status: response.status, body };
}

async function waitForIndicators(path, expected) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await call(path);
    assert.equal(response.status, 200, "Indicators request failed during setup or verification");
    if (response.body.attemptCount === expected) return response.body;
    await setTimeout(500);
  }
  assert.fail("ClickHouse did not deliver the expected scoped count");
}

function processResources() {
  // PID 1 is the running Express server, not this separate docker exec process.
  const stat = readFileSync("/proc/1/stat", "utf8");
  const afterName = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  const cpuMs = (Number(afterName[11]) + Number(afterName[12])) * 1000 / clockTicks;
  const rssKiB = Number(/^VmRSS:\s+(\d+) kB$/m.exec(readFileSync("/proc/1/status", "utf8"))?.[1]);
  assert.ok(Number.isFinite(cpuMs) && Number.isFinite(rssKiB), "Could not sample the Express process");
  return { cpuMs, rssKiB };
}

function percentile(sorted, percentage) {
  return Number(sorted[Math.ceil(percentage * sorted.length) - 1].toFixed(2));
}

async function counters() {
  const response = await call("/internal/v1/cache/metrics");
  assert.equal(response.status, 200);
  assert.ok(response.body.redisReady, "Start Express with the Redis override");
  return response.body;
}

async function measure(workload, round, concurrency, operation, acceptedStatus) {
  const before = await counters();
  const startResources = processResources();
  let rssPeak = startResources.rssKiB;
  const sampler = setInterval(() => { rssPeak = Math.max(rssPeak, processResources().rssKiB); }, 100);
  const statuses = Object.create(null);
  const latencies = [];
  let failures = 0;
  let index = 0;

  async function lane() {
    while (index < requests) {
      const position = index++;
      const startedAt = performance.now();
      try {
        const result = await operation(position);
        statuses[result.status] = (statuses[result.status] ?? 0) + 1;
        if (result.status !== acceptedStatus) failures++;
      } catch {
        statuses.transportOrValidationError = (statuses.transportOrValidationError ?? 0) + 1;
        failures++;
      } finally {
        latencies.push(performance.now() - startedAt);
      }
    }
  }

  const startedAt = performance.now();
  try { await Promise.all(Array.from({ length: concurrency }, lane)); }
  finally { clearInterval(sampler); }

  const elapsedMs = performance.now() - startedAt;
  const endResources = processResources();
  const after = await counters();
  const view = workload.startsWith("progress") ? "progress"
    : workload.startsWith("indicators") ? "indicators" : undefined;
  const result = {
    workload, round, concurrency, requests, statuses, failures,
    p50Ms: percentile(latencies.sort((a, b) => a - b), 0.50),
    p95Ms: percentile(latencies, 0.95),
    successfulPerSecond: Number(((requests - failures) * 1000 / elapsedMs).toFixed(2)),
    expressCpuMs: endResources.cpuMs - startResources.cpuMs,
    expressRssPeakMiB: Number((Math.max(rssPeak, endResources.rssKiB) / 1024).toFixed(1)),
    ...(view && {
      hits: after[view].hits - before[view].hits,
      misses: after[view].misses - before[view].misses,
      sourceReads: after[view].sourceReads - before[view].sourceReads,
    }),
    ...(workload === "registered-replays" && {
      progressInvalidations: after.progress.invalidations - before.progress.invalidations,
    }),
  };
  console.log(JSON.stringify(result));
  assert.equal(failures, 0, "Unexpected responses in " + workload);
}

function verifyAnalytics(body, events) {
  assert.equal(body.attemptCount, events.length);
  assert.equal(body.totalDurationMs, events.reduce((sum, item) => sum + item.durationMs, 0));
  const average = events.reduce((sum, item) => sum + item.score, 0) / events.length;
  assert.ok(Math.abs(body.averageScore - average) < 1e-9);
  assert.ok(Number.isSafeInteger(body.ingestionLagMs) && body.ingestionLagMs >= 0);
}

const write = (attempt) => call("/internal/v1/attempts", attempt);
const setupScope = fixture();
const warmPaths = paths(setupScope);
const original = event(setupScope, 2);
assert.equal((await write(original)).status, 201);
verifyAnalytics(await waitForIndicators(warmPaths.indicators, 1), [original]);
assert.equal((await call(warmPaths.progress)).body.items[0].attemptCount, 1);

for (let round = 1; round <= rounds; round++) {
  // Reverse the order on alternate runs to reduce a systematic warm-up advantage.
  const levels = round % 2 === 1 ? levelSet : [...levelSet].reverse();
  for (const concurrency of levels) {
    const scope = fixture();
    const urls = paths(scope);
    const events = Array.from({ length: requests }, (_, index) => event(scope, index));
    await measure("unique-writes", round, concurrency, (index) => write(events[index]), 201);
    const progreso = (await call(urls.progress)).body;
    assert.equal(progreso.items.length, 1);
    assert.equal(progreso.items[0].attemptCount, requests);
    verifyAnalytics(await waitForIndicators(urls.indicators, requests), events);

    await measure("registered-replays", round, concurrency, () => write(original), 200);
    assert.equal((await call(warmPaths.progress)).body.items[0].attemptCount, 1);
    verifyAnalytics(await waitForIndicators(warmPaths.indicators, 1), [original]);

    const cold = paths(fixture());
    await measure("progress-cold-key", round, concurrency, async () => {
      const result = await call(cold.progress);
      if (result.status === 200) assert.deepEqual(result.body.items, []);
      return result;
    }, 200);

    await measure("indicators-warm", round, concurrency, async () => {
      const result = await call(warmPaths.indicators);
      if (result.status === 200) verifyAnalytics(result.body, [original]);
      return result;
    }, 200);
  }
}
