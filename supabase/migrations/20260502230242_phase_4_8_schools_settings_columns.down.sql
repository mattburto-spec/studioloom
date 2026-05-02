-- Rollback for: phase_4_8_schools_settings_columns
-- Pairs with: 20260502230242_phase_4_8_schools_settings_columns.sql
--
-- Drops the 8 added columns. Refuses if any have non-default values
-- (would lose data). content_sharing_default has a non-NULL default
-- so we exempt that from the data-loss check.

DO $$
DECLARE
  v_data_count INT;
BEGIN
  SELECT COUNT(*) INTO v_data_count
  FROM schools
  WHERE academic_calendar_jsonb IS NOT NULL
     OR timetable_skeleton_jsonb IS NOT NULL
     OR frameworks_in_use_jsonb IS NOT NULL
     OR default_grading_scale IS NOT NULL
     OR notification_branding_jsonb IS NOT NULL
     OR safeguarding_contacts_jsonb IS NOT NULL
     OR default_student_ai_budget IS NOT NULL;

  IF v_data_count > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % schools have non-NULL Phase 4.8 '
                    'settings columns (would lose data). Clear those '
                    'columns first if you really want to revert.',
                    v_data_count;
  END IF;
END $$;

ALTER TABLE schools DROP COLUMN IF EXISTS default_student_ai_budget;
ALTER TABLE schools DROP COLUMN IF EXISTS content_sharing_default;
ALTER TABLE schools DROP COLUMN IF EXISTS safeguarding_contacts_jsonb;
ALTER TABLE schools DROP COLUMN IF EXISTS notification_branding_jsonb;
ALTER TABLE schools DROP COLUMN IF EXISTS default_grading_scale;
ALTER TABLE schools DROP COLUMN IF EXISTS frameworks_in_use_jsonb;
ALTER TABLE schools DROP COLUMN IF EXISTS timetable_skeleton_jsonb;
ALTER TABLE schools DROP COLUMN IF EXISTS academic_calendar_jsonb;
