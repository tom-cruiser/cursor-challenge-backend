-- Migration 002: Platform admin role + hospital verification workflow
-- Status: FUTURE — apply when super-admin layer is implemented
-- Depends on: 001 (20260705100000_initial_schema.sql)

-- ---------------------------------------------------------------------------
-- Extend user_role enum with platform admin
-- ---------------------------------------------------------------------------
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- ---------------------------------------------------------------------------
-- Hospital verification audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE hospital_verification_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id  UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  notes        TEXT,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hospital_verification_hospital ON hospital_verification_requests (hospital_id);
CREATE INDEX idx_hospital_verification_status ON hospital_verification_requests (status) WHERE status = 'pending';

CREATE TRIGGER trg_hospital_verification_updated_at
  BEFORE UPDATE ON hospital_verification_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Enforce verified hospitals on parent-facing discovery (optional flag)
-- ---------------------------------------------------------------------------
ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill verified_at for already-verified seed hospitals
UPDATE hospitals
SET verified_at = created_at
WHERE is_verified = true AND verified_at IS NULL;

-- ---------------------------------------------------------------------------
-- Platform admin seed (update phone before production)
-- ---------------------------------------------------------------------------
-- INSERT INTO users (phone, email, name, country, role)
-- VALUES ('+250780000000', 'admin@quekiapp.com', 'Platform Admin', 'Rwanda', 'admin')
-- ON CONFLICT (phone) DO UPDATE SET role = 'admin';
