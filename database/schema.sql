-- User accounts table
CREATE TABLE IF NOT EXISTS app_users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Secure sync table with optimistic concurrency versioning
CREATE TABLE IF NOT EXISTS app_sync_data_secure (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    tool_key TEXT NOT NULL,
    payload_ciphertext TEXT NOT NULL,
    data_hash TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tool_key)
);

CREATE INDEX IF NOT EXISTS idx_sync_secure_user_id ON app_sync_data_secure (user_id);
CREATE INDEX IF NOT EXISTS idx_sync_secure_tool_key ON app_sync_data_secure (tool_key);
