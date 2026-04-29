-- Rollback for: phase_1_5b_student_progress_self_read
-- Pairs with: 20260429133400_phase_1_5b_student_progress_self_read.sql

DROP POLICY IF EXISTS "Students read own progress" ON student_progress;
