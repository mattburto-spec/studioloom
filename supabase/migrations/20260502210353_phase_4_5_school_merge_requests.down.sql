-- Rollback for: phase_4_5_school_merge_requests
-- Pairs with: 20260502210353_phase_4_5_school_merge_requests.sql
--
-- ROLLBACK ORDER (reverse of forward migration):
--   1. Drop RLS policies (must come before DROP TABLE — Postgres rejects)
--   2. Drop indexes (technically dropped by DROP TABLE, but explicit)
--   3. Drop table school_merge_requests
--   4. Drop schools.merged_into_id column + its index
--   5. Drop ENUM school_merge_status (must come AFTER table — type still
--      referenced by table column otherwise)
--
-- This rollback is intended for fresh-prod / pre-data scenarios. If any
-- school has been merged via the helper before rollback, the cascade
-- updates have already happened — those rows are NOT reversed here.
-- Reverse-merge is the helper's job, not the migration's.

-- 1. RLS policies
DROP POLICY IF EXISTS "smr_school_teacher_read"  ON school_merge_requests;
DROP POLICY IF EXISTS "smr_platform_admin_all"   ON school_merge_requests;

-- 2. Indexes (defensive — DROP TABLE drops these anyway)
DROP INDEX IF EXISTS idx_smr_unique_pending;
DROP INDEX IF EXISTS idx_smr_into_status;
DROP INDEX IF EXISTS idx_smr_from_status;

-- 3. Table
DROP TABLE IF EXISTS school_merge_requests;

-- 4. schools.merged_into_id + its index
DROP INDEX IF EXISTS idx_schools_merged_into;
ALTER TABLE schools DROP COLUMN IF EXISTS merged_into_id;

-- 5. ENUM
DROP TYPE IF EXISTS school_merge_status;
