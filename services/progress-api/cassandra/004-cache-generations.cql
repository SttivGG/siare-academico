CREATE TABLE IF NOT EXISTS siare_progress.cache_generations (
    student_id uuid,
    subject_id uuid,
    cache_kind text,
    generation uuid,
    PRIMARY KEY ((student_id, subject_id), cache_kind)
);
