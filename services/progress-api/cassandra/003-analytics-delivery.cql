-- A missing confirmation time means that the durable attempt is pending delivery.
ALTER TABLE siare_progress.attempts ADD IF NOT EXISTS analytics_confirmed_at timestamp;
