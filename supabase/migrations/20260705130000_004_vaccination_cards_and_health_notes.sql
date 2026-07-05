-- Migration 004: Vaccination card uploads + child health notes history
-- Status: FUTURE — apply when Supabase Storage integration is added
-- Depends on: 001, 002, 003

-- ---------------------------------------------------------------------------
-- Vaccination card file metadata (actual files live in Supabase Storage)
-- Bucket suggestion: vaccination-cards (private, parent + hospital read)
-- ---------------------------------------------------------------------------
CREATE TABLE vaccination_card_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     UUID NOT NULL REFERENCES child_schedules(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_bucket  TEXT NOT NULL DEFAULT 'vaccination-cards',
  storage_path    TEXT NOT NULL,
  public_url      TEXT,
  mime_type       TEXT,
  file_size_bytes INT CHECK (file_size_bytes > 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vaccination_card_schedule UNIQUE (schedule_id)
);

CREATE INDEX idx_vaccination_cards_schedule ON vaccination_card_uploads (schedule_id);
CREATE INDEX idx_vaccination_cards_uploader ON vaccination_card_uploads (uploaded_by);

-- Link child_schedules.card_photo_url to structured uploads (optional FK)
ALTER TABLE child_schedules
  ADD COLUMN IF NOT EXISTS card_upload_id UUID REFERENCES vaccination_card_uploads(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Child health notes timeline (beyond single notes field on children)
-- ---------------------------------------------------------------------------
CREATE TABLE child_health_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note        TEXT NOT NULL,
  note_type   TEXT NOT NULL DEFAULT 'general'
                CHECK (note_type IN ('general', 'allergy', 'reaction', 'missed_dose')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_child_health_notes_child ON child_health_notes (child_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Supabase Storage policy reference (apply via dashboard or storage migration)
-- ---------------------------------------------------------------------------
-- Policy: parents can upload/read cards for their own children's schedules
-- Policy: hospital operators can read cards for schedules at their hospital
-- Policy: card paths: {hospital_id}/{child_id}/{schedule_id}.{ext}
