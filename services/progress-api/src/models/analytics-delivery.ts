import { setTimeout } from "node:timers/promises";
import cassandra from "cassandra-driver";
import { parseAttemptEvent } from "./attempt-event.js";
import type { AnalyticsSink } from "./analytics.model.js";
import type { ProgressScope } from "./progress.model.js";

const scan = "SELECT attempt_id, payload, recorded_at, analytics_confirmed_at FROM siare_progress.attempts";
const confirm = "UPDATE siare_progress.attempts SET analytics_confirmed_at = ? WHERE attempt_id = ?";
const pageSize = 32;
const idleMs = 3000;
const consistency = cassandra.types.consistencies.localQuorum;

export function startAnalyticsDelivery(
  client: cassandra.Client,
  sink: AnalyticsSink,
  invalidateIndicators: (scope: ProgressScope) => Promise<void>,
) {
  const controller = new AbortController();
  const { signal } = controller;

  async function deliver() {
    let pageState: cassandra.QueryOptions["pageState"];
    let delay = 0;
    let failures = 0;
    while (!signal.aborted) {
      await setTimeout(delay, undefined, { signal }).catch((error) => {
        if (!signal.aborted) throw error;
      });
      if (signal.aborted) break;
      try {
        const page = await client.execute(scan, [], { fetchSize: pageSize, pageState, consistency });
        const pending = page.rows.filter((row) => row.analytics_confirmed_at == null);
        const events = pending.map((row) => {
          const event = parseAttemptEvent(JSON.parse(row.payload));
          if (!event) throw new Error("Invalid persisted attempt");
          return { event, recordedAt: row.recorded_at as Date };
        });
        await sink.insert(events, signal);
        const scopes = new Map(events.map(({ event }) => [event.studentId + ":" + event.subjectId, event]));
        for (const scope of scopes.values()) {
          if (signal.aborted) break;
          await invalidateIndicators(scope);
        }
        const confirmedAt = new Date();
        // Rows stay pending after an ambiguous insert or after a failed acknowledgment.
        // ClickHouse reads group by event_id, so a replay cannot increment indicators.
        for (const row of pending) {
          if (signal.aborted) break;
          await client.execute(confirm, [confirmedAt, row.attempt_id], { prepare: true, consistency });
        }
        if (failures) console.info("Analytics delivery recovered");
        failures = 0;
        pageState = page.pageState ?? undefined;
        delay = pageState ? 100 : idleMs;
      } catch {
        if (signal.aborted) break;
        failures++;
        console.warn("Analytics delivery pending; retrying", { failures });
        delay = Math.min(30_000, idleMs * 2 ** Math.min(failures - 1, 4));
      }
    }
  }

  const task = deliver();
  return async () => {
    controller.abort();
    await task;
  };
}
