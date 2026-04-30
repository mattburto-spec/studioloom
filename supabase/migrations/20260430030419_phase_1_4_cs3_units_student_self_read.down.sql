-- Rollback for: phase_1_4_cs3_units_student_self_read
-- Pairs with: 20260430030419_phase_1_4_cs3_units_student_self_read.sql
--
-- Drops the additive student-side SELECT policy. Pre-CS-3 state had
-- only "Teachers read own or published units" + "Authors update/delete
-- own units" + "Teachers insert units" — students could only read
-- published units. Reverting will silently 0-row CS-3 routes for any
-- unpublished unit a student is enrolled in.

DROP POLICY IF EXISTS "Students read own assigned units" ON units;
