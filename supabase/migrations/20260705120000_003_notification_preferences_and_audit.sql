-- Migration 003: Per-user notification preferences + delivery audit log
-- Status: FUTURE — apply when customizable reminder offsets are implemented
-- Depends on: 001, 002

-- ---------------------------------------------------------------------------
-- Parent notification preferences (override per-vaccine reminder_days)
-- ---------------------------------------------------------------------------
CREATE TABLE user_notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  reminder_days   INT[] NOT NULL DEFAULT '{3,1}',
  enable_push     BOOLEAN NOT NULL DEFAULT true,
  enable_email    BOOLEAN NOT NULL DEFAULT true,
  enable_sms      BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end   TIME,
  timezone        TEXT NOT NULL DEFAULT 'Africa/Kigali',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_user ON user_notification_preferences (user_id);

CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Notification delivery log (FCM / Resend / SMS audit)
-- ---------------------------------------------------------------------------
CREATE TYPE notification_channel AS ENUM ('fcm', 'email', 'sms');
CREATE TYPE notification_status AS ENUM ('sent', 'failed', 'skipped');

CREATE TABLE notification_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id     UUID REFERENCES children(id) ON DELETE SET NULL,
  schedule_id  UUID REFERENCES child_schedules(id) ON DELETE SET NULL,
  channel      notification_channel NOT NULL,
  status       notification_status NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  error_message TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_user ON notification_log (user_id, created_at DESC);
CREATE INDEX idx_notification_log_schedule ON notification_log (schedule_id);
CREATE INDEX idx_notification_log_status ON notification_log (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Auto-create default preferences for existing parents
-- ---------------------------------------------------------------------------
INSERT INTO user_notification_preferences (user_id)
SELECT id FROM users WHERE role = 'parent'
ON CONFLICT (user_id) DO NOTHING;
