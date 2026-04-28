-- Rollback for: soft_delete_and_unit_version_refs
-- Pairs with: 20260428135317_soft_delete_and_unit_version_refs.sql
-- Phase: Access Model v2 Phase 0.4
--
-- No data to preserve — every column was NULL on every row.

ALTER TABLE student_tool_sessions   DROP COLUMN IF EXISTS unit_version_id;
ALTER TABLE fabrication_jobs        DROP COLUMN IF EXISTS unit_version_id;
ALTER TABLE gallery_submissions     DROP COLUMN IF EXISTS unit_version_id;
ALTER TABLE student_progress        DROP COLUMN IF EXISTS unit_version_id;
ALTER TABLE portfolio_entries       DROP COLUMN IF EXISTS unit_version_id;
ALTER TABLE competency_assessments  DROP COLUMN IF EXISTS unit_version_id;
ALTER TABLE assessment_records      DROP COLUMN IF EXISTS unit_version_id;

ALTER TABLE units    DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE teachers DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE students DROP COLUMN IF EXISTS deleted_at;
