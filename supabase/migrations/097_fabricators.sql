-- Migration 097: fabricators + fabricator_sessions + fabricator_machines + RLS
--
-- Preflight Phase 1A-5. Fabricator auth system (D-05). Fabricators are the
-- lab techs who pick up scanned jobs for fabrication. They have their own
-- identity (separate from Supabase Auth teachers and token-session students).
--
-- Three tables:
--   fabricators          — identity + bcrypt password + invite trail
--   fabricator_sessions  — token-session records (cookie-based, like students)
--   fabricator_machines  — junction: which machines each fabricator can pick up for
--
-- Auth model (same shape as student_sessions per Lesson #4):
--   Login: POST /fab/login → email + password → bcrypt verify → create session row
--     with bcrypt-hashed session_token → set cookie → redirect to /fab/queue.
--   Every request validates cookie via service-role lookup of session_token_hash.
--   Never Supabase Auth — Fabricators never appear in auth.users.
--
-- RLS model:
--   fabricators:
--     - Teacher SELECT/UPDATE/INSERT on invited_by_teacher_id = auth.uid()
--     - Fabricator self-access via service role (auth.uid() IS NULL under
--       token sessions so RLS silently denies; app layer handles scope)
--   fabricator_sessions: deny-all. Service role only (same pattern as
--     student_sessions, ai_model_config, fabrication_scan_jobs).
--   fabricator_machines:
--     - Teacher SELECT/INSERT/DELETE for fabricators they invited.
--
-- Refs:
--   - Decision: docs/projects/fabrication/phase-0-decisions.md (D-05 auth architecture)
--   - Spec:     docs/projects/fabrication-pipeline.md §10 (lab tech UX)
--   - Brief:    docs/projects/preflight-phase-1a-brief.md (1A-5)
--   - Lessons:  #4 (token auth pattern), #24 (idempotent), #29-style dual scope (not needed here)

-- ============================================================
-- 1. Table: fabricators
-- ============================================================

CREATE TABLE IF NOT EXISTS fabricators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,

  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,           -- bcrypt; initially NULL-sentinel only via invite flow
  display_name TEXT NOT NULL,

  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Invite audit trail. ON DELETE SET NULL: keep fabricator record if teacher departs.
  invited_by_teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- Case-insensitive unique email (bob@school.com == Bob@School.com)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fabricators_email_lower
  ON fabricators(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_fabricators_invited_by
  ON fabricators(invited_by_teacher_id)
  WHERE invited_by_teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fabricators_active
  ON fabricators(is_active)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trigger_fabricators_updated_at ON fabricators;
CREATE TRIGGER trigger_fabricators_updated_at
  BEFORE UPDATE ON fabricators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Table: fabricator_sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS fabricator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fabricator_id UUID NOT NULL REFERENCES fabricators(id) ON DELETE CASCADE,

  -- Cookie value is random 32-byte token; stored as bcrypt hash
  session_token_hash TEXT NOT NULL UNIQUE,

  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fabricator_sessions_fabricator_id
  ON fabricator_sessions(fabricator_id);

-- Cleanup cron target
CREATE INDEX IF NOT EXISTS idx_fabricator_sessions_expires_at
  ON fabricator_sessions(expires_at);

-- No updated_at trigger — sessions are insert-once; last_seen_at is a direct write.

-- ============================================================
-- 3. Table: fabricator_machines (junction)
-- ============================================================

CREATE TABLE IF NOT EXISTS fabricator_machines (
  fabricator_id UUID NOT NULL REFERENCES fabricators(id) ON DELETE CASCADE,
  machine_profile_id UUID NOT NULL REFERENCES machine_profiles(id) ON DELETE CASCADE,
  assigned_by_teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fabricator_id, machine_profile_id)
);

-- Reverse lookup: "who can pick up for this machine?"
CREATE INDEX IF NOT EXISTS idx_fabricator_machines_machine_id
  ON fabricator_machines(machine_profile_id);

-- ============================================================
-- 4. RLS: fabricators (teacher can see/manage invited fabricators)
-- ============================================================

ALTER TABLE fabricators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fabricators_select_teacher ON fabricators;
CREATE POLICY fabricators_select_teacher
  ON fabricators
  FOR SELECT
  USING (invited_by_teacher_id = auth.uid());

DROP POLICY IF EXISTS fabricators_insert_teacher ON fabricators;
CREATE POLICY fabricators_insert_teacher
  ON fabricators
  FOR INSERT
  WITH CHECK (invited_by_teacher_id = auth.uid());

DROP POLICY IF EXISTS fabricators_update_teacher ON fabricators;
CREATE POLICY fabricators_update_teacher
  ON fabricators
  FOR UPDATE
  USING (invited_by_teacher_id = auth.uid())
  WITH CHECK (invited_by_teacher_id = auth.uid());

-- DELETE deliberately NOT policy-enabled: teachers can deactivate (is_active=false)
-- but not hard-delete (preserves audit trail). Hard delete = admin only via service role.

-- ============================================================
-- 5. RLS: fabricator_sessions (deny-all — service role only)
-- ============================================================
-- Same pattern as student_sessions / ai_model_config / fabrication_scan_jobs.
-- Cookie validation happens via service role. Will appear in scan-rls-coverage
-- as rls_enabled_no_policy — intentional.

ALTER TABLE fabricator_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS: fabricator_machines (teacher manages their fabricators)
-- ============================================================

ALTER TABLE fabricator_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fabricator_machines_select_teacher ON fabricator_machines;
CREATE POLICY fabricator_machines_select_teacher
  ON fabricator_machines
  FOR SELECT
  USING (
    fabricator_id IN (
      SELECT id FROM fabricators WHERE invited_by_teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS fabricator_machines_insert_teacher ON fabricator_machines;
CREATE POLICY fabricator_machines_insert_teacher
  ON fabricator_machines
  FOR INSERT
  WITH CHECK (
    fabricator_id IN (
      SELECT id FROM fabricators WHERE invited_by_teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS fabricator_machines_delete_teacher ON fabricator_machines;
CREATE POLICY fabricator_machines_delete_teacher
  ON fabricator_machines
  FOR DELETE
  USING (
    fabricator_id IN (
      SELECT id FROM fabricators WHERE invited_by_teacher_id = auth.uid()
    )
  );

-- No UPDATE policy — junction rows are immutable (insert or delete only).

-- ============================================================
-- 7. Post-apply verification (run separately in dashboard)
-- ============================================================
--   -- RLS on all 3 tables
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('fabricators', 'fabricator_sessions', 'fabricator_machines')
--   ORDER BY relname;
--   -- Expect: all 3 | t
--
--   -- Policies: 3 on fabricators + 3 on fabricator_machines + 0 on fabricator_sessions = 6 total
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('fabricators', 'fabricator_sessions', 'fabricator_machines')
--   ORDER BY tablename, cmd, policyname;
--   -- Expect 6 rows:
--   --   fabricator_machines | fabricator_machines_delete_teacher  | DELETE
--   --   fabricator_machines | fabricator_machines_insert_teacher  | INSERT
--   --   fabricator_machines | fabricator_machines_select_teacher  | SELECT
--   --   fabricators         | fabricators_insert_teacher          | INSERT
--   --   fabricators         | fabricators_select_teacher          | SELECT
--   --   fabricators         | fabricators_update_teacher          | UPDATE
--
--   -- Empty
--   SELECT COUNT(*) FROM fabricators;           -- 0
--   SELECT COUNT(*) FROM fabricator_sessions;   -- 0
--   SELECT COUNT(*) FROM fabricator_machines;   -- 0
--
--   -- Email case-insensitive uniqueness (in BEGIN/ROLLBACK):
--   BEGIN;
--     INSERT INTO fabricators (email, password_hash, display_name, invited_by_teacher_id)
--       VALUES ('Alice@Lab.com', 'bcrypt-dummy', 'Alice', NULL);
--     INSERT INTO fabricators (email, password_hash, display_name, invited_by_teacher_id)
--       VALUES ('alice@lab.com', 'bcrypt-dummy', 'Alice-2', NULL);
--     -- Expect: ERROR duplicate key on uq_fabricators_email_lower
--   ROLLBACK;
