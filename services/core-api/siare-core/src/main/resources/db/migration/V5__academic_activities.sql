CREATE TABLE academic_activities (
    id CHAR(36) NOT NULL PRIMARY KEY,
    subject_id CHAR(36) NOT NULL,
    document_id CHAR(36),
    family VARCHAR(16) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    status VARCHAR(16) NOT NULL,
    public_content_json MEDIUMTEXT NOT NULL,
    answer_key_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_activity_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
    CONSTRAINT ck_activity_family CHECK (family IN ('QUIZ','CROSSWORD')),
    CONSTRAINT ck_activity_status CHECK (status IN ('AVAILABLE'))
);
CREATE INDEX ix_activity_subject_id ON academic_activities(subject_id,id);
CREATE INDEX ix_activity_document ON academic_activities(document_id);

CREATE TABLE academic_attempts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    activity_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    event_id CHAR(36) NOT NULL,
    idempotency_key CHAR(36) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    score DOUBLE NOT NULL,
    duration_ms BIGINT NOT NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    result_json MEDIUMTEXT NOT NULL,
    CONSTRAINT fk_attempt_activity FOREIGN KEY (activity_id) REFERENCES academic_activities(id),
    CONSTRAINT fk_attempt_student FOREIGN KEY (student_id) REFERENCES users(id),
    CONSTRAINT uk_attempt_idempotency UNIQUE (activity_id,student_id,idempotency_key),
    CONSTRAINT uk_attempt_event UNIQUE (event_id),
    CONSTRAINT ck_attempt_score CHECK (score >= 0 AND score <= 1),
    CONSTRAINT ck_attempt_duration CHECK (duration_ms >= 0 AND duration_ms <= 86400000)
);
CREATE INDEX ix_attempt_student_activity ON academic_attempts(student_id,activity_id,occurred_at);

CREATE TABLE academic_attempt_outbox (
    event_id CHAR(36) NOT NULL PRIMARY KEY,
    attempt_id CHAR(36) NOT NULL,
    payload_json MEDIUMTEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    delivery_attempts INT NOT NULL DEFAULT 0,
    available_at TIMESTAMP(6) NOT NULL,
    lease_token CHAR(36),
    lease_until TIMESTAMP(6),
    delivered_at TIMESTAMP(6),
    CONSTRAINT fk_outbox_attempt FOREIGN KEY (attempt_id) REFERENCES academic_attempts(id),
    CONSTRAINT uk_outbox_attempt UNIQUE (attempt_id),
    CONSTRAINT ck_outbox_status CHECK (status IN ('PENDING','DELIVERED'))
);
CREATE INDEX ix_outbox_pending ON academic_attempt_outbox(status,available_at,lease_until);
