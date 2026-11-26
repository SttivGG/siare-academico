-- Exact, case-sensitive issuer/subject comparison independent of MySQL's default collation.
CREATE TABLE external_identities (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    issuer VARCHAR(512) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    linked_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_external_issuer_subject UNIQUE (issuer, subject),
    CONSTRAINT fk_external_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX ix_external_user ON external_identities(user_id, linked_at);
-- Serializes creation/link/unlink, including identities not yet present. Never a web session.
CREATE TABLE federation_control (id INT NOT NULL PRIMARY KEY);
INSERT INTO federation_control(id) VALUES (1);
