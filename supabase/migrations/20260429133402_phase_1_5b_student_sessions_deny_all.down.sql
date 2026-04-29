-- Rollback for: phase_1_5b_student_sessions_deny_all
-- Pairs with: 20260429133402_phase_1_5b_student_sessions_deny_all.sql

DROP POLICY IF EXISTS "student_sessions_deny_all" ON student_sessions;
