CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    display_name VARCHAR(120) NOT NULL DEFAULT '',
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'ru',
    start_tab VARCHAR(20) NOT NULL DEFAULT 'dashboard',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'user')),
    CONSTRAINT users_language_check CHECK (preferred_language IN ('ru', 'en')),
    CONSTRAINT users_start_tab_check CHECK (start_tab IN ('dashboard', 'status', 'devices', 'metrics', 'logs', 'settings'))
);

CREATE INDEX idx_users_role ON users (role);
