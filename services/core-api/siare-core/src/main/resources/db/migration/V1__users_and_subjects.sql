CREATE TABLE users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(60) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE subjects (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(2000),
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_subjects_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX ix_subjects_user_created ON subjects(user_id, created_at);
