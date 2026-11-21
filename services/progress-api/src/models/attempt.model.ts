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

      const attempt = await client.execute(
        "INSERT INTO siare_progress.attempts (attempt_id, event_id, payload, recorded_at) VALUES (?, ?, ?, ?) IF NOT EXISTS",
        [attemptId, eventId, payload, now],
        options,
      );
      if (attempt.wasApplied()) {
        await applyProgress(event);
        return { outcome: "recorded", recordedAt: now };
      }

      const existing = attempt.first();
      if (existing.event_id.equals(eventId)) {
        // The durable write may precede a failed progress update. Replaying repairs it.
        await applyProgress(event);
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
