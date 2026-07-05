-- Vaccination Reminder Web App — Dual-sided schema (Parent + Hospital)
-- Cursor Kigali Hackathon 2026

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('parent', 'hospital');
CREATE TYPE catalog_item_type AS ENUM ('vaccine', 'checkup');
CREATE TYPE schedule_status AS ENUM ('pending', 'due_soon', 'completed', 'overdue');
CREATE TYPE registration_source AS ENUM ('self', 'manual');

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users (parents and hospital operators)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL UNIQUE,
  email      TEXT,
  name       TEXT,
  country    TEXT,
  role       user_role NOT NULL DEFAULT 'parent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users (phone);
CREATE INDEX idx_users_role ON users (role);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- hospitals
-- ---------------------------------------------------------------------------
CREATE TABLE hospitals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  address         TEXT,
  latitude        FLOAT8 NOT NULL,
  longitude       FLOAT8 NOT NULL,
  help_phone      TEXT,
  country         TEXT,
  services        TEXT[] NOT NULL DEFAULT '{}',
  operating_hours JSONB NOT NULL DEFAULT '{}',
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_hospitals_latitude  CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_hospitals_longitude CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_hospitals_lat_lng ON hospitals (latitude, longitude);
CREATE INDEX idx_hospitals_verified ON hospitals (is_verified) WHERE is_verified = true;
CREATE INDEX idx_hospitals_owner ON hospitals (owner_id);

CREATE TRIGGER trg_hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- hospital_vaccines (per-hospital vaccine registry with age ranges + cron days)
-- ---------------------------------------------------------------------------
CREATE TABLE hospital_vaccines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  item_type             catalog_item_type NOT NULL DEFAULT 'vaccine',
  age_min_months        INT NOT NULL DEFAULT 0 CHECK (age_min_months >= 0),
  age_max_months        INT NOT NULL CHECK (age_max_months >= age_min_months),
  milestone_age_months  INT NOT NULL CHECK (milestone_age_months >= 0),
  dose_number           INT NOT NULL DEFAULT 1 CHECK (dose_number >= 1),
  purpose               TEXT,
  details               TEXT,
  reminder_days         INT[] NOT NULL DEFAULT '{3,1}',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hospital_vaccine UNIQUE (hospital_id, name, dose_number)
);

CREATE INDEX idx_hospital_vaccines_hospital ON hospital_vaccines (hospital_id) WHERE is_active = true;

CREATE TRIGGER trg_hospital_vaccines_updated_at
  BEFORE UPDATE ON hospital_vaccines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- parent_hospital_registrations
-- ---------------------------------------------------------------------------
CREATE TABLE parent_hospital_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  source              registration_source NOT NULL DEFAULT 'self',
  registered_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_parent_hospital UNIQUE (parent_id, hospital_id)
);

CREATE INDEX idx_registrations_hospital ON parent_hospital_registrations (hospital_id);
CREATE INDEX idx_registrations_parent ON parent_hospital_registrations (parent_id);

-- ---------------------------------------------------------------------------
-- children
-- ---------------------------------------------------------------------------
CREATE TABLE children (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  date_of_birth         DATE NOT NULL,
  sex                   TEXT CHECK (sex IN ('male', 'female', 'other')),
  notes                 TEXT,
  preferred_hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_children_parent_id ON children (parent_id);
CREATE INDEX idx_children_hospital ON children (preferred_hospital_id);

CREATE TRIGGER trg_children_updated_at
  BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- child_schedules (ledger tied to hospital vaccines)
-- ---------------------------------------------------------------------------
CREATE TABLE child_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  hospital_vaccine_id UUID NOT NULL REFERENCES hospital_vaccines(id) ON DELETE RESTRICT,
  due_date            DATE NOT NULL,
  status              schedule_status NOT NULL DEFAULT 'pending',
  completed_at        TIMESTAMPTZ,
  completed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  card_photo_url      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_child_vaccine_schedule UNIQUE (child_id, hospital_vaccine_id)
);

CREATE INDEX idx_child_schedules_child_due ON child_schedules (child_id, due_date);
CREATE INDEX idx_child_schedules_due_status ON child_schedules (due_date, status);
CREATE INDEX idx_child_schedules_hospital ON child_schedules (hospital_id, status);

-- ---------------------------------------------------------------------------
-- fcm_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE fcm_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_fcm_tokens_user_active ON fcm_tokens (user_id) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Seed: demo hospital operator + hospital + vaccines
-- ---------------------------------------------------------------------------
INSERT INTO users (phone, email, name, country, role)
VALUES ('+250780000001', 'hospital@kigalihealth.rw', 'Kigali Health Admin', 'Rwanda', 'hospital');

INSERT INTO hospitals (owner_id, name, address, latitude, longitude, help_phone, country, services, operating_hours, is_verified)
SELECT
  u.id,
  'Kigali University Teaching Hospital',
  'KN 4 Ave, Kigali',
  -1.9441,
  30.0619,
  '+250788123456',
  'Rwanda',
  ARRAY['vaccination', 'pediatrics', 'emergency'],
  '{
    "monday":    {"open": "07:30", "close": "17:00", "vaccination": true},
    "tuesday":   {"open": "07:30", "close": "17:00", "vaccination": true},
    "wednesday": {"open": "07:30", "close": "17:00", "vaccination": true},
    "thursday":  {"open": "07:30", "close": "17:00", "vaccination": true},
    "friday":    {"open": "07:30", "close": "17:00", "vaccination": true},
    "saturday":  {"open": "08:00", "close": "12:00", "vaccination": true},
    "sunday":    {"open": null,    "close": null,    "vaccination": false}
  }'::jsonb,
  true
FROM users u WHERE u.phone = '+250780000001';

INSERT INTO hospital_vaccines (hospital_id, name, item_type, age_min_months, age_max_months, milestone_age_months, dose_number, purpose, details, reminder_days)
SELECT h.id, v.name, v.item_type::catalog_item_type, v.age_min, v.age_max, v.milestone, v.dose, v.purpose, v.details, '{3,1}'
FROM hospitals h
CROSS JOIN (VALUES
  ('BCG',                  'vaccine',  0,  1,  0,  1, 'Tuberculosis protection', 'Given at birth'),
  ('OPV-0',                'vaccine',  0,  1,  0,  1, 'Polio prevention',        'Oral polio dose at birth'),
  ('Birth Health Checkup', 'checkup',  0,  1,  0,  1, 'Newborn assessment',      'Weight, reflexes, general health'),
  ('Pentavalent-1',        'vaccine',  1,  2,  1,  1, 'Combined immunization',   'DPT, HepB, Hib — dose 1'),
  ('OPV-1',                'vaccine',  1,  2,  1,  1, 'Polio prevention',        'Oral polio dose 1'),
  ('Pentavalent-2',        'vaccine',  2,  3,  2,  1, 'Combined immunization',   'DPT, HepB, Hib — dose 2'),
  ('Pentavalent-3',        'vaccine',  3,  6,  3,  1, 'Combined immunization',   'DPT, HepB, Hib — dose 3'),
  ('Measles-Rubella-1',    'vaccine',  9,  12, 9,  1, 'Measles & rubella',       'First MR dose at 9 months'),
  ('Measles-Rubella-2',    'vaccine',  15, 24, 18, 1, 'Measles & rubella',       'Second MR dose at 18 months')
) AS v(name, item_type, age_min, age_max, milestone, dose, purpose, details)
WHERE h.name = 'Kigali University Teaching Hospital';

INSERT INTO users (phone, email, name, country, role)
VALUES ('+250780000002', 'hospital@kingfaisal.rw', 'King Faisal Admin', 'Rwanda', 'hospital');

INSERT INTO hospitals (owner_id, name, address, latitude, longitude, help_phone, country, services, operating_hours, is_verified)
SELECT
  u.id,
  'King Faisal Hospital',
  'KG 544 St, Kigali',
  -1.9536,
  30.0925,
  '+250788654321',
  'Rwanda',
  ARRAY['vaccination', 'maternity', 'general'],
  '{
    "monday":    {"open": "08:00", "close": "18:00", "vaccination": true},
    "tuesday":   {"open": "08:00", "close": "18:00", "vaccination": true},
    "wednesday": {"open": "08:00", "close": "18:00", "vaccination": true},
    "thursday":  {"open": "08:00", "close": "18:00", "vaccination": true},
    "friday":    {"open": "08:00", "close": "18:00", "vaccination": true},
    "saturday":  {"open": "09:00", "close": "13:00", "vaccination": false},
    "sunday":    {"open": null,    "close": null,    "vaccination": false}
  }'::jsonb,
  true
FROM users u WHERE u.phone = '+250780000002';
