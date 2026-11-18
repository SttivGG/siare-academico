ALTER TABLE user_sessions ADD COLUMN authentication_level VARCHAR(16) NOT NULL DEFAULT 'PASSWORD';
ALTER TABLE user_sessions ADD COLUMN mfa_verified_at TIMESTAMP(6);
ALTER TABLE user_sessions ADD COLUMN mfa_expires_at TIMESTAMP(6);

-- MySQL is authoritative. Lock user_access first for ALL credential mutations.
CREATE TABLE mfa_credentials (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    active_secret VARCHAR(512),
    pending_secret VARCHAR(512),
    pending_expires_at TIMESTAMP(6),
    last_used_step BIGINT NOT NULL DEFAULT -1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE mfa_challenges (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    consumed_at TIMESTAMP(6),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_mfa_challenge_user ON mfa_challenges(user_id);
CREATE INDEX ix_mfa_challenge_expiry ON mfa_challenges(expires_at);
CREATE TABLE mfa_recovery_codes (
    code_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    consumed_at TIMESTAMP(6),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_mfa_recovery_user ON mfa_recovery_codes(user_id);
CREATE TABLE password_reset_tokens (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    consumed_at TIMESTAMP(6),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX ix_password_reset_expiry ON password_reset_tokens(expires_at);
