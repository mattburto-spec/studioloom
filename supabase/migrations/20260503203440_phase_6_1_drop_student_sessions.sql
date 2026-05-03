-- Migration: phase_6_1_drop_student_sessions
-- Created: 20260503203440 UTC
-- Phase: Access Model v2 Phase 6.1 (legacy student token deprecation)
--
-- WHY: Phases 1.2–1.4 migrated student authentication to Supabase Auth
--   (sb-* cookies, JWTs, app_metadata.user_type='student'). The legacy
--   `questerra_student_session` cookie + `student_sessions` table coexisted
--   during the dual-mode grace window so all 56 student routes could run on
--   either path. Phase 6.1 closes that window: every route is migrated to
--   `requireStudentSession()` in the same commit as this DROP, the legacy
--   `requireStudentAuth` shim is deleted, and the table is removed.
--
--   Pre-flight verified by Matt 4 May 2026 PM: 0 rows in `students` (active +
--   soft-deleted; 7 test students hard-deleted by Phase 4.3.z on 2 May), 0
--   rows in `student_sessions`. No real student data is being destroyed.
--
-- IMPACT: 1 table dropped (`student_sessions`).
--   - Drops table + its indexes (PK on token, FK on student_id, expiry index).
--   - Drops the `student_session_grace_period` column comment if present.
--   - No RLS policies attached (table was service-role-only and flagged as
--     intentional deny-all in Phase 6.5's rls-deny-all.md).
-- ROLLBACK: paired .down.sql is intentionally a no-op stub. The table held
--   only short-lived session tokens (TTL ≤ 24h); rollback would not restore
--   any meaningful state. See .down.sql for the full rationale.

-- ============================================================
-- 1. Sanity assertion (Lesson #66) — refuse to run if rows exist.
-- ============================================================
-- Belt + braces: pre-flight already verified 0 rows, but if a parallel
-- session somehow inserted between Matt's check and migration apply, this
-- DO-block aborts the migration rather than silently destroying session
-- state. The pre-flight is the gate; this is the safety net.

DO $$
DECLARE
  v_student_count INTEGER;
  v_session_count INTEGER;
BEGIN
  -- students table is the authority — if any students exist, sessions might
  -- be transient but could still represent in-flight logins worth preserving
  -- a beat to investigate.
  SELECT COUNT(*) INTO v_student_count FROM students;
  SELECT COUNT(*) INTO v_session_count FROM student_sessions;

  IF v_student_count > 0 THEN
    RAISE EXCEPTION 'phase_6_1_drop_student_sessions: refusing to drop — students table has % row(s). Pre-flight expected 0. Investigate before re-applying.', v_student_count;
  END IF;

  IF v_session_count > 0 THEN
    RAISE EXCEPTION 'phase_6_1_drop_student_sessions: refusing to drop — student_sessions has % row(s). Pre-flight expected 0. Investigate before re-applying.', v_session_count;
  END IF;
END $$;

-- ============================================================
-- 2. Drop the table
-- ============================================================
-- IF EXISTS guards re-runs (e.g., on a Supabase env where this was already
-- applied manually). CASCADE not used — there are no FKs pointing at this
-- table; if any survive the audit, the migration should fail loudly.

DROP TABLE IF EXISTS student_sessions;
