-- Rollback for: phase_1_5b_class_students_self_read_authuid
-- Pairs with: 20260429133359_phase_1_5b_class_students_self_read_authuid.sql

DROP POLICY IF EXISTS "Students read own enrollments via auth.uid" ON class_students;
