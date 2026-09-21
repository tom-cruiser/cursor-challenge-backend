-- Backend-issued authentication (phone + password). Replaces Supabase Auth.
-- Credentials live in their own table so `SELECT * FROM users` (used widely by
-- the API and embedded in joins) can never leak a password hash.
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
