-- Phase 1.1a — Student auth.users FK column
--
-- Project: Access Model v2
-- Phase: 1 (Auth Unification)
-- Sub-phase: 4.1a (ADD COLUMN students.user_id)
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.1
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Phase 0 added `user_profiles` (the polymorphic identity extension of
-- auth.users) and explicitly DEFERRED bringing students into auth.users —
-- see comments in 20260428142618_user_profiles.sql. Phase 1 closes that
-- deferral. This migration adds the FK column ONLY (column-add). The
-- backfill is performed by a TS script using the Supabase Admin SDK
-- (cannot be done via plain SQL because creating auth.users rows requires
-- supabase.auth.admin.createUser()). The NOT NULL tighten happens in a
-- separate later migration, after every route uses the new helper
-- (Phase 1.6 cleanup or a dedicated 1.1c migration).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - students gains user_id (UUID NULL, FK auth.users(id) ON DELETE SET NULL)
-- - One partial index on (user_id) WHERE user_id IS NOT NULL
-- - No backfill in this migration — populated by the script + tightened later
-- - No RLS policy changes — students already has RLS enabled with
--   teacher-managed policies; once user_id is populated, Phase 1.5 will
--   add a "students read own row via auth.uid() = user_id" policy in a
--   separate migration. Belt-and-suspenders during the transition.
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql drops the column + index. Safe pre-Phase-1.4 (no routes
-- read user_id yet); becomes destructive once Phase 1.4 routes are live.

-- ============================================================
-- 1. Add nullable FK column
-- ============================================================
-- ON DELETE SET NULL — same pattern as students.school_id (mig 20260428134250),
-- author_teacher_id (mig 041), and other student FKs. If an auth.users row is
-- deleted (admin cleanup, GDPR delete, rotated test account) the student row
-- stays alive but becomes auth-orphaned. Phase 1's routes treat user_id IS
-- NULL as "needs re-backfill" rather than auto-deleting the student.
--
-- IF NOT EXISTS guard for re-running the migration; matches Phase 0 pattern
-- (Lesson #24 — migrations should be idempotent).

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS user_id UUID NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Partial index (only populated rows)
-- ============================================================
-- WHERE clause uses IS NOT NULL only — IMMUTABLE expression, safe per Lesson #61.
-- Pattern matches idx_students_school_id (Phase 0 mig 20260428134250).

CREATE INDEX IF NOT EXISTS idx_students_user_id
  ON students(user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================
-- 3. Comment for future readers
-- ============================================================

COMMENT ON COLUMN students.user_id IS
  'FK to auth.users — populated by Phase 1.1b backfill script (scripts/access-v2/backfill-student-auth-users.ts). NULL pre-backfill; tightened to NOT NULL in a later Phase 1 migration after all routes use getStudentSession().';
