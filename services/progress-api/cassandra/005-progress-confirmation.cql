-- A missing marker means a replay must finish progress and its cache invalidation.
ALTER TABLE siare_progress.attempts ADD IF NOT EXISTS progress_confirmed_at timestamp;
