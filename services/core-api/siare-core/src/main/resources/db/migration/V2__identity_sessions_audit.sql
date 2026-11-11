ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL;

CREATE TABLE roles (name VARCHAR(20) NOT NULL PRIMARY KEY);
INSERT INTO roles (name) VALUES ('USER'), ('ADMIN'), ('SUPERADMIN');
CREATE TABLE administrative_scopes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    version BIGINT NOT NULL DEFAULT 0
);
INSERT INTO administrative_scopes (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Comunidad SIARE');
CREATE TABLE user_access (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    role_name VARCHAR(20) NOT NULL DEFAULT 'USER',
    scope_id CHAR(36) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_name) REFERENCES roles(name),
    FOREIGN KEY (scope_id) REFERENCES administrative_scopes(id)
);
INSERT INTO user_access (user_id, scope_id) SELECT id, '00000000-0000-0000-0000-000000000001' FROM users;
CREATE INDEX ix_user_access_scope ON user_access(scope_id, role_name);
CREATE TABLE user_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    last_seen_at TIMESTAMP(6) NOT NULL,
    idle_expires_at TIMESTAMP(6) NOT NULL,
    absolute_expires_at TIMESTAMP(6) NOT NULL,
    revoked_at TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_sessions_user ON user_sessions(user_id, created_at);
CREATE INDEX ix_sessions_expiry ON user_sessions(absolute_expires_at);
CREATE TABLE refresh_tokens (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    consumed_at TIMESTAMP(6),
    FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE CASCADE
);
CREATE INDEX ix_refresh_session ON refresh_tokens(session_id);
CREATE TABLE audit_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    actor_id CHAR(36),
    operation VARCHAR(64) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    scope_id CHAR(36)
);
CREATE INDEX ix_audit_date ON audit_events(occurred_at, id);
CREATE TABLE login_attempts (
    attempt_key CHAR(64) NOT NULL PRIMARY KEY,
    window_start TIMESTAMP(6) NOT NULL,
    attempts INT NOT NULL
);
CREATE TABLE identity_control (id INT NOT NULL PRIMARY KEY, bootstrapped BOOLEAN NOT NULL DEFAULT FALSE);
CREATE INDEX ix_attempt_window ON login_attempts(window_start);
INSERT INTO identity_control (id) VALUES (1);
CREATE TABLE identity_parameters (
    name VARCHAR(64) NOT NULL PRIMARY KEY,
    enabled BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
INSERT INTO identity_parameters(name,enabled) VALUES ('public_registration_enabled',TRUE);
