-- Rollback for: phase_1_5_students_self_read
-- Pairs with: 20260429130730_phase_1_5_students_self_read.sql

DROP POLICY IF EXISTS "Students read own row" ON students;
