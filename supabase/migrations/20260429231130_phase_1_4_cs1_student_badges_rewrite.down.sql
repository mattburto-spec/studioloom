-- Rollback for: phase_1_4_cs1_student_badges_rewrite
-- Pairs with: 20260429231130_phase_1_4_cs1_student_badges_rewrite.sql
--
-- Restores the ORIGINAL broken policy from migration 035. We're
-- preserving the broken state (rather than improving it) because
-- rollback should bring us back to exactly what was deployed before
-- the rewrite — even if that was wrong.
--
-- If you're rolling back, you almost certainly want to also revert the
-- CS-2/CS-3 route switches (otherwise routes will silently 0-row on
-- student_badges reads).

DROP POLICY IF EXISTS student_badges_read_own ON student_badges;

CREATE POLICY student_badges_read_own ON student_badges
  FOR SELECT USING (
    student_id::text = COALESCE(current_setting('app.student_id', true), '')
    OR student_id::text = COALESCE((current_setting('request.jwt.claims', true)::json->>'sub'), '')
  );
