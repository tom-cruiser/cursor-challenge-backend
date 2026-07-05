-- AI Chat System — sessions, messages, and performance indexes
-- Cursor Kigali Hackathon 2026

CREATE TYPE chat_message_role AS ENUM ('user', 'assistant', 'system');

-- ---------------------------------------------------------------------------
-- chat_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions (user_id);
CREATE INDEX idx_chat_sessions_user_updated ON chat_sessions (user_id, updated_at DESC);

CREATE TRIGGER trg_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        chat_message_role NOT NULL,
  content     TEXT NOT NULL,
  is_flagged  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_chat_messages_content_nonempty CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX idx_chat_messages_session_created ON chat_messages (session_id, created_at ASC);
CREATE INDEX idx_chat_messages_flagged ON chat_messages (session_id, is_flagged) WHERE is_flagged = true;

-- Touch parent session updated_at whenever a message is inserted
CREATE OR REPLACE FUNCTION touch_chat_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
  SET updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chat_messages_touch_session
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION touch_chat_session_updated_at();
