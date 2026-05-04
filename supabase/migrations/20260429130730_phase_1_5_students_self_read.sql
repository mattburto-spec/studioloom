-- Phase 1.5 — students self-read RLS policy
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.5
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Phase 1.1a added `students.user_id` (FK auth.users(id)). Phase 1.1b
-- backfilled it for all 7 prod students. Phase 1.2's classcode-login
-- mints Supabase sessions with `auth.uid() = students.user_id` for the
-- logged-in student.
--
-- Without a self-read policy, an RLS-respecting query like:
--   `SELECT * FROM students WHERE id = $1`
-- returns 0 rows EVEN FOR THE STUDENT'S OWN ROW because no policy permits
-- the read. The existing "Teachers manage students" policy doesn't apply
-- because the actor is a student, not a teacher.
--
-- This adds the missing self-read path: `auth.uid() = user_id` lets a
-- logged-in student SELECT their own row via RLS. Adjacent students stay
-- invisible. Teacher access remains unchanged (the existing teacher-side
-- policy continues to apply per Postgres RLS OR-semantics across policies).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SELECT-only policy on `students` table
-- - No data change
-- - Existing "Teachers manage students" policy unaffected
-- - Phase 1.4 routes that switch to the SSR client get correct results
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql drops the new policy. Safe to roll back any time —
-- only impact is that students-via-Supabase-Auth lose their self-read
-- (but the legacy admin-client path keeps working regardless).

CREATE POLICY "Students read own row"
  ON students
  FOR SELECT
  USING (
    -- Students.user_id is the FK to auth.users(id). Phase 1.1b populated
    -- it for all backfilled students; Phase 1.1d auto-populates new ones.
    -- A student.user_id IS NULL means the row predates Phase 1 and the
    -- student hasn't logged in yet via the new flow — they fall back to
    -- the legacy admin-client path which bypasses RLS.
    user_id = auth.uid()
  );

COMMENT ON POLICY "Students read own row" ON students IS
  'Phase 1.5 — Students authenticated via Supabase Auth (user_id = auth.uid()) can SELECT their own row. Coexists with the existing "Teachers manage students" policy via Postgres OR-semantics. Service-role admin client bypasses RLS regardless.';
