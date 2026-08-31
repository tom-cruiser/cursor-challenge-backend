-- Migration 005: Row-Level Security (defense-in-depth)
-- Cursor Kigali Hackathon 2026
--
-- Context: the Express backend connects with the Supabase SERVICE ROLE key
-- (see src/config/database.ts), which always bypasses RLS — every policy
-- below is a second line of defense, not a replacement for the Express-layer
-- authorization checks already in place. It matters because Supabase exposes
-- every table over the PostgREST REST API by default; without RLS enabled,
-- anyone holding the project's anon key (which is not secret — it ships in
-- any client) can read or write every row in every table directly, bypassing
-- the backend entirely. It also protects against a future code path (e.g. a
-- mobile client, or a frontend change) that queries Supabase directly with
-- the user's own JWT instead of going through the backend.
--
-- This app does not use Supabase Auth's own `auth.users` table as the source
-- of identity — `public.users` is a separate, backend-managed table keyed by
-- phone number (see src/middleware/auth.ts: resolveUser). A verified JWT's
-- `phone` claim is the only trustworthy identity signal, so policies below
-- resolve "the current app user" from `auth.jwt() ->> 'phone'` rather than
-- from `auth.uid()` (which has no defined relationship to public.users.id
-- here, and would error on the phone-string `sub` used by dev-minted tokens).

-- ---------------------------------------------------------------------------
-- Helpers: resolve the requesting principal from the verified JWT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE phone = (auth.jwt() ->> 'phone') LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app_current_hospital_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id FROM hospitals h WHERE h.owner_id = app_current_user_id() LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_self ON users
  FOR SELECT
  USING (id = app_current_user_id());

-- A hospital operator can look up basic info for parents registered at
-- their own hospital (needed for the parents/children admin views).
CREATE POLICY users_select_registered_parent ON users
  FOR SELECT
  USING (
    role = 'parent'
    AND EXISTS (
      SELECT 1 FROM parent_hospital_registrations r
      WHERE r.parent_id = users.id
        AND r.hospital_id = app_current_hospital_id()
    )
  );

-- No direct INSERT/UPDATE/DELETE policies: user provisioning and profile
-- updates go through the backend's service-role connection only.

-- ---------------------------------------------------------------------------
-- hospitals
-- ---------------------------------------------------------------------------
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

-- Hospital directory info is intentionally readable by any signed-in user —
-- the nearby-hospitals search has no ownership restriction in the app either.
CREATE POLICY hospitals_select_any_authenticated ON hospitals
  FOR SELECT
  USING (auth.jwt() IS NOT NULL);

CREATE POLICY hospitals_insert_own ON hospitals
  FOR INSERT
  WITH CHECK (owner_id = app_current_user_id());

CREATE POLICY hospitals_update_own ON hospitals
  FOR UPDATE
  USING (owner_id = app_current_user_id())
  WITH CHECK (owner_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- hospital_vaccines
-- ---------------------------------------------------------------------------
ALTER TABLE hospital_vaccines ENABLE ROW LEVEL SECURITY;

-- Vaccine catalog rows are non-sensitive and needed by parents (timeline
-- joins) as well as hospital admins.
CREATE POLICY hospital_vaccines_select_any_authenticated ON hospital_vaccines
  FOR SELECT
  USING (auth.jwt() IS NOT NULL);

CREATE POLICY hospital_vaccines_write_own_hospital ON hospital_vaccines
  FOR ALL
  USING (hospital_id = app_current_hospital_id())
  WITH CHECK (hospital_id = app_current_hospital_id());

-- ---------------------------------------------------------------------------
-- parent_hospital_registrations
-- ---------------------------------------------------------------------------
ALTER TABLE parent_hospital_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY registrations_select_own ON parent_hospital_registrations
  FOR SELECT
  USING (
    parent_id = app_current_user_id()
    OR hospital_id = app_current_hospital_id()
  );

CREATE POLICY registrations_insert_self ON parent_hospital_registrations
  FOR INSERT
  WITH CHECK (parent_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- children
-- ---------------------------------------------------------------------------
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE POLICY children_all_own_parent ON children
  FOR ALL
  USING (parent_id = app_current_user_id())
  WITH CHECK (parent_id = app_current_user_id());

CREATE POLICY children_select_registered_hospital ON children
  FOR SELECT
  USING (preferred_hospital_id = app_current_hospital_id());

-- ---------------------------------------------------------------------------
-- child_schedules
-- ---------------------------------------------------------------------------
ALTER TABLE child_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY child_schedules_select_owner ON child_schedules
  FOR SELECT
  USING (
    hospital_id = app_current_hospital_id()
    OR EXISTS (
      SELECT 1 FROM children c
      WHERE c.id = child_schedules.child_id
        AND c.parent_id = app_current_user_id()
    )
  );

CREATE POLICY child_schedules_update_owner ON child_schedules
  FOR UPDATE
  USING (
    hospital_id = app_current_hospital_id()
    OR EXISTS (
      SELECT 1 FROM children c
      WHERE c.id = child_schedules.child_id
        AND c.parent_id = app_current_user_id()
    )
  );

-- No direct INSERT/DELETE policy: schedules are generated and pruned by the
-- backend (schedule.service.ts) via the service-role connection only.

-- ---------------------------------------------------------------------------
-- fcm_tokens
-- ---------------------------------------------------------------------------
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY fcm_tokens_all_own ON fcm_tokens
  FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- chat_sessions / chat_messages (AI assistant)
-- ---------------------------------------------------------------------------
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_sessions_all_own ON chat_sessions
  FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

CREATE POLICY chat_messages_all_own_session ON chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.user_id = app_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.user_id = app_current_user_id()
    )
  );
