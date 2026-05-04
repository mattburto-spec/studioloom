-- Rollback for: phase_1_5_quest_journeys_student_rewrite
-- Pairs with: 20260429130732_phase_1_5_quest_journeys_student_rewrite.sql
--
-- Restores the original (broken) policy shapes from migration 046.

DROP POLICY IF EXISTS quest_journeys_student_select ON quest_journeys;
DROP POLICY IF EXISTS quest_journeys_student_update ON quest_journeys;
DROP POLICY IF EXISTS quest_milestones_student ON quest_milestones;
DROP POLICY IF EXISTS quest_evidence_student ON quest_evidence;

CREATE POLICY quest_journeys_student_select
  ON quest_journeys
  FOR SELECT
  USING (
    student_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

CREATE POLICY quest_journeys_student_update
  ON quest_journeys
  FOR UPDATE
  USING (
    student_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

CREATE POLICY quest_milestones_student
  ON quest_milestones
  FOR ALL
  USING (
    journey_id IN (
      SELECT id FROM quest_journeys
      WHERE student_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY quest_evidence_student
  ON quest_evidence
  FOR ALL
  USING (
    journey_id IN (
      SELECT id FROM quest_journeys
      WHERE student_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );
