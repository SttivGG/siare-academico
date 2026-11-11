-- Runs in CLICKHOUSE_DB. Schema preparation only: no simulated academic records.
CREATE TABLE IF NOT EXISTS academic_events
(
    event_id UUID,
    occurred_at DateTime64(3, 'UTC'),
    student_id UUID,
    subject_id UUID,
    activity_id Nullable(UUID),
    event_type LowCardinality(String),
    score Nullable(Float64),
    duration_ms UInt64,
    source LowCardinality(String),
    schema_version UInt16 DEFAULT 1
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (subject_id, student_id, occurred_at, event_id);
