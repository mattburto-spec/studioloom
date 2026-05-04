-- Rollback for: phase_1_1a_student_user_id_column
-- Pairs with: 20260429073552_phase_1_1a_student_user_id_column.sql
--
-- Drops the index first (CASCADE not needed; partial index has no dependents),
-- then the column. CASCADE on column drop because the FK constraint dies with
-- it — no other table references students.user_id at this point in Phase 1.
--
-- WARNING: rolling this back AFTER the Phase 1.1b backfill script has populated
-- user_id values DROPS THE LINKAGE between students and auth.users. The
-- auth.users rows themselves persist (deletion is a separate script step with
-- --rollback flag). To fully roll back including the auth.users rows, run:
--
--   tsx scripts/access-v2/backfill-student-auth-users.ts --rollback
--
-- BEFORE applying this .down.sql.

DROP INDEX IF EXISTS idx_students_user_id;

ALTER TABLE students DROP COLUMN IF EXISTS user_id;
