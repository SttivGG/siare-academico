-- Apply inside CLICKHOUSE_DB. Existing rows have no recording or ingestion time.
ALTER TABLE academic_events
    ADD COLUMN IF NOT EXISTS recorded_at Nullable(DateTime64(3, 'UTC')),
    ADD COLUMN IF NOT EXISTS ingested_at Nullable(DateTime64(3, 'UTC'))
        DEFAULT if(recorded_at IS NULL, NULL, now64(3, 'UTC'));
