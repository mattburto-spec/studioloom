-- Rollback for: phase_1_4_cs1_assessment_records_student_self_read
-- Pairs with: 20260429231124_phase_1_4_cs1_assessment_records_student_self_read.sql
--
-- Drops the additive student-side SELECT policy. The pre-Phase-1.4 state
-- has only the teacher policy + service-role policy on this table.

DROP POLICY IF EXISTS "Students read own published assessments" ON assessment_records;
