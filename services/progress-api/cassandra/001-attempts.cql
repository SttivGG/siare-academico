-- Single-datacenter local SIARE installation. Apply as a separate migration.
CREATE KEYSPACE IF NOT EXISTS siare_progress
WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': 1}
AND durable_writes = true;

CREATE TABLE IF NOT EXISTS siare_progress.event_claims (
    event_id uuid PRIMARY KEY,
    fingerprint text
);

CREATE TABLE IF NOT EXISTS siare_progress.attempts (
    attempt_id uuid PRIMARY KEY,
    event_id uuid,
    payload text,
    recorded_at timestamp
);
