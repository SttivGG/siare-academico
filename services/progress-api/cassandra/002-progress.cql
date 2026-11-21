-- row_kind 0 holds activity summaries; row_kind 1 holds applied attempt IDs.
-- Both rows share a partition so a conditional batch updates them atomically.
CREATE TABLE IF NOT EXISTS siare_progress.progress_by_scope (
    student_id uuid,
    subject_id uuid,
    bucket int,
    row_kind int,
    activity_id text,
    attempt_id text,
    attempt_count bigint,
    best_score double,
    last_score double,
    last_attempt_at text,
    last_attempt_id text,
    PRIMARY KEY ((student_id, subject_id, bucket), row_kind, activity_id, attempt_id)
);
