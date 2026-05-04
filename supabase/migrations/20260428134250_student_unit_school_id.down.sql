-- Rollback for: student_unit_school_id
-- Pairs with: 20260428134250_student_unit_school_id.sql
-- Phase: Access Model v2 Phase 0.3
--
-- Drops indexes first (they reference the columns), then the columns.
-- Backfilled data is lost on rollback — re-running forward will repeat
-- the backfill from teacher chain (idempotent: UPDATE WHERE school_id
-- IS NULL).

DROP INDEX IF EXISTS idx_units_school_id;
DROP INDEX IF EXISTS idx_students_school_id;

ALTER TABLE units DROP COLUMN IF EXISTS school_id;
ALTER TABLE students DROP COLUMN IF EXISTS school_id;
