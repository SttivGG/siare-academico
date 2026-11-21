import type { AttemptEvent } from "./attempt-event.js";
import type { ProgressScope } from "./progress.model.js";

export interface AnalyticsWindow extends ProgressScope {
  from: Date;
  to: Date;
}

export interface Indicators {
  attemptCount: number;
  averageScore: number | null;
  totalDurationMs: number;
  asOf: string | null;
  ingestionLagMs: number | null;
}

export interface AnalyticsReader {
  indicators(window: AnalyticsWindow): Promise<Indicators>;
}

export interface AnalyticsEvent {
  event: AttemptEvent;
  recordedAt: Date;
}

export interface AnalyticsSink {
  insert(events: AnalyticsEvent[], signal?: AbortSignal): Promise<void>;
}

const insertQuery = `INSERT INTO academic_events
(event_id, occurred_at, student_id, subject_id, activity_id, event_type, score, duration_ms, source, schema_version, recorded_at, ingested_at)
FORMAT JSONEachRow`;

const indicatorQuery = `
SELECT
    count() AS attemptCount,
    avgOrNull(dedup_score) AS averageScore,
    sum(dedup_duration) AS totalDurationMs,
    if(count() = 0, NULL, toUnixTimestamp64Milli(max(first_ingested_at))) AS watermarkMs,
    if(count() = 0, NULL, argMax(lag_ms, tuple(first_ingested_at, event_id))) AS ingestionLagMs
FROM (
    SELECT
        event_id,
        any(assumeNotNull(score)) AS dedup_score,
        any(duration_ms) AS dedup_duration,
        min(assumeNotNull(ingested_at)) AS first_ingested_at,
        greatest(0, dateDiff('millisecond', min(assumeNotNull(recorded_at)), first_ingested_at)) AS lag_ms
    FROM academic_events
    WHERE student_id = {studentId:UUID}
      AND subject_id = {subjectId:UUID}
      AND occurred_at >= fromUnixTimestamp64Milli({from:Int64}, 'UTC')
      AND occurred_at < fromUnixTimestamp64Milli({to:Int64}, 'UTC')
      AND event_type = 'ATTEMPT_EVALUATED' AND source = 'core-api' AND schema_version = 1
      AND score IS NOT NULL AND recorded_at IS NOT NULL AND ingested_at IS NOT NULL
    GROUP BY event_id
)
FORMAT JSONEachRow`;

function dateTime(value: Date) {
  return value.toISOString().slice(0, -1).replace("T", " ");
}

interface ClickHouseConfig {
  url: string;
  username: string;
  password: string;
  database: string;
}

export function createClickHouseAnalytics({ url, username, password, database }: ClickHouseConfig): AnalyticsReader & AnalyticsSink {
  async function execute(query: string, body?: string, parameters?: Record<string, string>, signal?: AbortSignal) {
    const endpoint = new URL(url);
    endpoint.searchParams.set("database", database);
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("wait_end_of_query", "1");
    endpoint.searchParams.set("async_insert", "0");
    endpoint.searchParams.set("input_format_defaults_for_omitted_fields", "1");
    endpoint.searchParams.set("output_format_json_quote_64bit_integers", "0");
    for (const [name, value] of Object.entries(parameters ?? {})) {
      endpoint.searchParams.set("param_" + name, value);
    }
    const timeout = AbortSignal.timeout(4000);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "X-ClickHouse-User": username, "X-ClickHouse-Key": password },
      body,
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("ClickHouse HTTP " + response.status);
    }
    return response.text();
  }

  return {
    async insert(events, signal) {
      if (!events.length) return;
      const ndjson = events.map(({ event, recordedAt }) => JSON.stringify({
        event_id: event.eventId,
        occurred_at: dateTime(new Date(event.occurredAt)),
        student_id: event.studentId,
        subject_id: event.subjectId,
        activity_id: event.activityId,
        event_type: event.eventType,
        score: event.score,
        duration_ms: event.durationMs,
        source: event.source,
        schema_version: event.schemaVersion,
        recorded_at: dateTime(recordedAt),
      })).join("\n") + "\n";
      // An INSERT has no result. Reject an unexpected body before acknowledging delivery.
      if ((await execute(insertQuery, ndjson, undefined, signal)).trim()) throw new Error("Unexpected INSERT response");
    },
    async indicators(window) {
      const body = await execute(indicatorQuery, undefined, {
        studentId: window.studentId,
        subjectId: window.subjectId,
        from: String(window.from.getTime()),
        to: String(window.to.getTime()),
      });
      const row = JSON.parse(body);
      if (!Number.isSafeInteger(row.attemptCount) || !Number.isSafeInteger(row.totalDurationMs)
          || (row.averageScore !== null && !Number.isFinite(row.averageScore))
          || (row.watermarkMs !== null && !Number.isSafeInteger(row.watermarkMs))
          || (row.ingestionLagMs !== null && !Number.isSafeInteger(row.ingestionLagMs))) {
        throw new Error("Invalid ClickHouse aggregate");
      }
      return {
        attemptCount: row.attemptCount,
        averageScore: row.averageScore,
        totalDurationMs: row.totalDurationMs,
        asOf: row.watermarkMs === null ? null : new Date(row.watermarkMs).toISOString(),
        ingestionLagMs: row.ingestionLagMs,
      };
    },
  };
}
