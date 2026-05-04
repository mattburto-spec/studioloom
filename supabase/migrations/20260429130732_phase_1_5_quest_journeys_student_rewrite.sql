-- Phase 1.5 — quest_journeys/milestones/evidence: rewrite student-side RLS
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.5
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY (audit finding from Phase 1.5 pre-flight)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 046 added 4 student-side policies on quest_journeys +
-- quest_milestones + quest_evidence:
--
--   quest_journeys_student_select  USING (student_id::text = current_setting('request.jwt.claims', true)::json->>'sub')
--   quest_journeys_student_update  USING (student_id::text = current_setting('request.jwt.claims', true)::json->>'sub')
--   quest_milestones_student       USING (journey_id IN (SELECT id FROM quest_journeys WHERE student_id::text = ...))
--   quest_evidence_student         USING (journey_id IN (SELECT id FROM quest_journeys WHERE student_id::text = ...))
--
-- The JWT `sub` claim IS auth.users.id. But `student_id` is `students.id`
-- (a separate UUID; Phase 1.1a's separation). So the comparison
-- `student_id::text = sub` is comparing one UUID to a different UUID and
-- always returns false.
--
-- Same bug class as competency_assessments (mig 20260429130731). Both
-- shipped pre-Phase-1 forward-looking; both broken once students have
-- real Supabase Auth sessions.
--
-- ───────────────────────────────────────────────────────────────────────────
-- FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- Replace all 4 policies with the auth.uid() → students.user_id → students.id
-- chain. Also simplify: `auth.uid()` is equivalent to current_setting JWT sub
-- but cleaner.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - 4 broken policies replaced with corrected versions
-- - Other policies on these tables (teacher access etc.) untouched
-- - No data change

DROP POLICY IF EXISTS quest_journeys_student_select ON quest_journeys;
DROP POLICY IF EXISTS quest_journeys_student_update ON quest_journeys;
DROP POLICY IF EXISTS quest_milestones_student ON quest_milestones;
DROP POLICY IF EXISTS quest_evidence_student ON quest_evidence;

CREATE POLICY quest_journeys_student_select
  ON quest_journeys
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY quest_journeys_student_update
  ON quest_journeys
  FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY quest_milestones_student
  ON quest_milestones
  FOR ALL
  USING (
    journey_id IN (
      SELECT id FROM quest_journeys
      WHERE student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY quest_evidence_student
  ON quest_evidence
  FOR ALL
  USING (
    journey_id IN (
      SELECT id FROM quest_journeys
      WHERE student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY quest_journeys_student_select ON quest_journeys IS
  'Phase 1.5 — Rewritten from broken (student_id::text = JWT sub) to use the auth.uid() → students.user_id → students.id chain. JWT sub IS auth.users.id, but student_id was students.id (a different UUID).';
