import { setTimeout } from "node:timers/promises";
import cassandra from "cassandra-driver";
import type { AttemptEvent } from "./attempt-event.js";

export interface ActivityProgress {
  activityId: string;
  attemptCount: number;
  bestScore: number;
  lastScore: number;
  lastAttemptAt: string;
}

export interface ProgressScope {
  studentId: string;
  subjectId: string;
}

export interface ProgressModel {
  list(scope: ProgressScope, limit: number, after?: string): Promise<ActivityProgress[]>;
}

const table = "siare_progress.progress_by_scope";
const read: cassandra.QueryOptions = { prepare: true, consistency: cassandra.types.consistencies.localQuorum };
const conditional = { ...read, serialConsistency: cassandra.types.consistencies.localSerial };
const partitionWhere = "student_id = ? AND subject_id = ? AND bucket = ?";
const rowWhere = partitionWhere + " AND row_kind = ? AND activity_id = ? AND attempt_id = ?";
const buckets = 16;
const bucketFor = (activityId: string) => Number.parseInt(activityId[0], 16);
const scopeIds = (scope: ProgressScope) => [
  cassandra.types.Uuid.fromString(scope.studentId), cassandra.types.Uuid.fromString(scope.subjectId),
];

function toActivity(row: cassandra.types.Row): ActivityProgress {
  const attemptCount = row.attempt_count.toNumber() as number;
  if (!Number.isSafeInteger(attemptCount)) throw new RangeError("Attempt count exceeds JSON precision");
  return {
    activityId: row.activity_id,
    attemptCount,
    bestScore: row.best_score,
    lastScore: row.last_score,
    lastAttemptAt: row.last_attempt_at,
  };
}

function timestampKey(instant: string) {
  const second = instant.slice(0, 19);
  const fraction = instant.slice(19, -1).replace(".", "");
  return second + fraction.padEnd(9, "0");
}

export function createCassandraProgressModel(client: cassandra.Client) {
  const writesByPartition = new Map<string, Promise<void>>();

  async function applyToPartition(event: AttemptEvent, bucket: number) {
    const partition = [...scopeIds(event), bucket];
    const markerKey = [...partition, 1, event.activityId, event.attemptId];
    const summaryKey = [...partition, 0, event.activityId, ""];

    for (let retry = 0; retry < 24; retry++) {
      const marker = await client.execute("SELECT attempt_id FROM " + table + " WHERE " + rowWhere, markerKey, read);
      if (marker.rowLength !== 0) return;
      const summary = (await client.execute("SELECT * FROM " + table + " WHERE " + rowWhere, summaryKey, read)).first();

      const previousTime = summary ? timestampKey(summary.last_attempt_at) : "";
      const eventTime = timestampKey(event.occurredAt);
      const isLatest = eventTime > previousTime
        || (eventTime === previousTime && event.attemptId > summary.last_attempt_id);
      const values = [
        summary ? summary.attempt_count.add(1) : cassandra.types.Long.fromNumber(1),
        Math.max(summary?.best_score ?? 0, event.score),
        isLatest ? event.score : summary.last_score,
        isLatest ? event.occurredAt : summary.last_attempt_at,
        isLatest ? event.attemptId : summary.last_attempt_id,
      ];
      const mutation = summary
        ? {
          query: "UPDATE " + table + " SET attempt_count = ?, best_score = ?, last_score = ?, last_attempt_at = ?, last_attempt_id = ? WHERE "
            + rowWhere + " IF attempt_count = ?",
          params: [...values, ...summaryKey, summary.attempt_count],
        }
        : {
          query: "INSERT INTO " + table
            + " (student_id, subject_id, bucket, row_kind, activity_id, attempt_id, attempt_count, best_score, last_score, last_attempt_at, last_attempt_id)"
            + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS",
          params: [...summaryKey, ...values],
        };

      // A retry can only observe either both committed rows or neither marker nor its increment.
      const result = await client.batch([
        {
          query: "INSERT INTO " + table
            + " (student_id, subject_id, bucket, row_kind, activity_id, attempt_id) VALUES (?, ?, ?, ?, ?, ?) IF NOT EXISTS",
          params: markerKey,
        },
        mutation,
      ], conditional);
      if (result.wasApplied()) return;
      await setTimeout(5 + Math.random() * Math.min(10 + retry * 5, 100));
    }
    throw new Error("Progress update contention");
  }

  return {
    async apply(event: AttemptEvent): Promise<void> {
      const bucket = bucketFor(event.activityId);
      const key = [event.studentId, event.subjectId, bucket].join(":");
      const previous = writesByPartition.get(key);
      // Keep Cassandra's conditional batch for correctness across processes. Within
      // one Express process, queue mutations to the same partition to reduce CAS retries.
      if (!previous && writesByPartition.size >= 128) return applyToPartition(event, bucket);
      const task = previous
        ? previous.then(() => applyToPartition(event, bucket), () => applyToPartition(event, bucket))
        : applyToPartition(event, bucket);
      writesByPartition.set(key, task);
      try { await task; }
      finally {
        if (writesByPartition.get(key) === task) writesByPartition.delete(key);
      }
    },

    async list(scope: ProgressScope, limit: number, after?: string): Promise<ActivityProgress[]> {
      const items: ActivityProgress[] = [];
      const ids = scopeIds(scope);
      const startBucket = after ? bucketFor(after) : 0;
      for (let bucket = startBucket; bucket < buckets && items.length <= limit; bucket++) {
        const result = await client.execute(
          "SELECT activity_id, attempt_count, best_score, last_score, last_attempt_at FROM " + table
            + " WHERE " + partitionWhere + " AND row_kind = 0 AND activity_id > ? LIMIT ?",
          [...ids, bucket, bucket === startBucket ? after ?? "" : "", limit + 1 - items.length],
          read,
        );
        items.push(...result.rows.map(toActivity));
      }
      return items;
    },
  } satisfies ProgressModel & { apply(event: AttemptEvent): Promise<void> };
}
