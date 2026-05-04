-- Rollback for: phase_1_4_cs1_classes_student_self_read
-- Pairs with: 20260429231118_phase_1_4_cs1_classes_student_self_read.sql
--
-- Drops the additive student-side SELECT policy. The pre-Phase-1.4 state
-- has only the "Teachers manage own classes" policy on this table, so
-- this rollback reverts to that exact state.

DROP POLICY IF EXISTS "Students read own enrolled classes" ON classes;
