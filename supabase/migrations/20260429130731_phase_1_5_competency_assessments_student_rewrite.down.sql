-- Rollback for: phase_1_5_competency_assessments_student_rewrite
-- Pairs with: 20260429130731_phase_1_5_competency_assessments_student_rewrite.sql
--
-- Restores the original (broken) policy shapes from migration 030. Use
-- only if a full Phase 1.5 RLS revert is needed; legacy admin-client
-- access works regardless.

DROP POLICY IF EXISTS "students_read_own" ON competency_assessments;
DROP POLICY IF EXISTS "students_create_self" ON competency_assessments;

CREATE POLICY "students_read_own"
  ON competency_assessments
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "students_create_self"
  ON competency_assessments
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND source = 'student_self'
  );
