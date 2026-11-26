import { createHash } from "node:crypto";
import cassandra from "cassandra-driver";
import type { AttemptEvent } from "./attempt-event.js";

export type RecordAttemptResult =
  | { outcome: "recorded" | "duplicate"; recordedAt: Date }
  | { outcome: "idempotency-conflict" | "attempt-conflict" };

export interface AttemptModel {
  record(event: AttemptEvent): Promise<RecordAttemptResult>;
}

const options: cassandra.QueryOptions = {
  prepare: true,
  consistency: cassandra.types.consistencies.localQuorum,
  serialConsistency: cassandra.types.consistencies.localSerial,
};

export function createCassandraAttemptModel(
  client: cassandra.Client,
  applyProgress: (event: AttemptEvent) => Promise<void>,
): AttemptModel {
  const inFlight = new Map<string, Promise<void>>();

  async function finishProgress(event: AttemptEvent, attemptId: cassandra.types.Uuid) {
    const current = inFlight.get(event.attemptId);
    if (current) return current;

    const task = (async () => {
      await applyProgress(event);
      // Persist completion only after the progress update and its cache generation change.
      await client.execute(
        "UPDATE siare_progress.attempts SET progress_confirmed_at = ? WHERE attempt_id = ?",
        [new Date(), attemptId],
        options,
      );
    })();
    if (inFlight.size >= 128) return task;
    inFlight.set(event.attemptId, task);
    try { await task; }
    finally { inFlight.delete(event.attemptId); }
  }

  return {
    async record(event) {
      // parseAttemptEvent emits properties in fixed order and normalizes the UTC instant.
      const payload = JSON.stringify(event);
      const fingerprint = createHash("sha256").update(payload).digest("hex");
      const eventId = cassandra.types.Uuid.fromString(event.eventId);
      const attemptId = cassandra.types.Uuid.fromString(event.attemptId);
      const now = new Date();

      // Claim the event identity before committing the attempt. A retry can finish an
      // interrupted claim. Only the second conditional write confirms a stored attempt.
      const claim = await client.execute(
        "INSERT INTO siare_progress.event_claims (event_id, fingerprint) VALUES (?, ?) IF NOT EXISTS",
        [eventId, fingerprint],
        options,
      );
      if (!claim.wasApplied() && claim.first().fingerprint !== fingerprint) {
        return { outcome: "idempotency-conflict" };
      }

      // When the claim already exists, try a quorum read before issuing another LWT.
      let existing = claim.wasApplied() ? undefined : (await client.execute(
        "SELECT event_id, recorded_at, progress_confirmed_at FROM siare_progress.attempts WHERE attempt_id = ?",
        [attemptId],
        options,
      )).first();
      if (!existing) {
        const attempt = await client.execute(
          "INSERT INTO siare_progress.attempts (attempt_id, event_id, payload, recorded_at) VALUES (?, ?, ?, ?) IF NOT EXISTS",
          [attemptId, eventId, payload, now],
          options,
        );
        if (attempt.wasApplied()) {
          await finishProgress(event, attemptId);
          return { outcome: "recorded", recordedAt: now };
        }
        existing = attempt.first();
      }
      if (existing.event_id.equals(eventId)) {
        if (!existing.progress_confirmed_at) await finishProgress(event, attemptId);
        return { outcome: "duplicate", recordedAt: existing.recorded_at };
      }

      // The existing attempt is immutable and belongs to a different event. Releasing
      // the losing claim leaves its event ID available without touching the winner.
      await client.execute(
        "DELETE FROM siare_progress.event_claims WHERE event_id = ? IF fingerprint = ?",
        [eventId, fingerprint],
        options,
      );
      return { outcome: "attempt-conflict" };
    },
  };
}
