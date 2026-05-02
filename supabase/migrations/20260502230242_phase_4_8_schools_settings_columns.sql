-- Migration: phase_4_8_schools_settings_columns
-- Created: 20260502230242 UTC
-- Phase: Access Model v2 Phase 4.8 (settings bubble-up)
--
-- WHY: Phase 4.4b shipped the change_type → applier registry mapping
--   for 8 future schools-table columns (academic_calendar_jsonb,
--   timetable_skeleton_jsonb, frameworks_in_use_jsonb,
--   default_grading_scale, notification_branding_jsonb,
--   safeguarding_contacts_jsonb, content_sharing_default,
--   default_student_ai_budget). The columns themselves were deferred
--   to this phase so the governance + apply paths could be built
--   before the columns landed. **Today: any change of those types
--   fails because the columns don't exist.** This migration adds them.
--
--   Per Decision 8 amendment + brief §4.8: school-tier members manage
--   these settings collaboratively; the helper layer
--   (proposeSchoolSettingChange) enforces governance (low/high stakes
--   + 2-teacher confirm + bootstrap-grace).
--
--   PRE-FLIGHT AUDIT FINDING (Lesson #54 + #59 — 3 May 2026):
--   The brief specced backfill from `teachers.school_profile.{periodLength,
--   bellTimes,frameworks}`. **That column does not exist on teachers**
--   (verified by grep). Only the calendar backfill from
--   school_calendar_terms has a real source. The other 7 columns
--   ship as forward-compat NULLs until UX populates them.
--
-- IMPACT:
--   - schools table gains 8 columns (7 nullable, 1 with a non-null
--     default for content_sharing_default).
--   - Backfill: academic_calendar_jsonb populated from the
--     most-recently-edited school_calendar_terms row per school.
--   - No RLS changes (schools RLS already established by mig 085).
--
-- ROLLBACK: paired .down.sql drops all 8 columns. Refuses if any have
--   non-NULL/non-default values.

-- ============================================================
-- 1. Add 8 columns
-- ============================================================

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS academic_calendar_jsonb JSONB NULL;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS timetable_skeleton_jsonb JSONB NULL;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS frameworks_in_use_jsonb JSONB NULL;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS default_grading_scale TEXT NULL;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS notification_branding_jsonb JSONB NULL;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS safeguarding_contacts_jsonb JSONB NULL;

-- content_sharing_default — has a default so existing rows get a
-- sensible value without explicit population. school_visible = the
-- common case for school-tier schools (units shared via library).
-- private = teacher-only (the default for free/pro personal schools).
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS content_sharing_default TEXT NOT NULL
    DEFAULT 'school_visible'
    CHECK (content_sharing_default IN ('school_visible', 'private'));

-- default_student_ai_budget — token-count override. Phase 5 will wire
-- the cascade resolution (tier default → school override → class →
-- student). NULL means "use tier default per Decision 6".
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS default_student_ai_budget INTEGER NULL
    CHECK (default_student_ai_budget IS NULL OR default_student_ai_budget >= 0);

COMMENT ON COLUMN schools.academic_calendar_jsonb IS
  'Phase 4.8 — bubbled-up academic calendar (terms + holidays). '
  'Backfilled from school_calendar_terms most-recently-edited per '
  'school. Read-precedence: class_units.schedule_overrides_jsonb → '
  'this column → school_calendar_terms (legacy fallback) per '
  'src/lib/access-v2/school/calendar.ts.';

COMMENT ON COLUMN schools.timetable_skeleton_jsonb IS
  'Phase 4.8 — bubbled-up timetable (period bells + period names). '
  'NULL until welcome-wizard timetable upload populates this surface '
  'in a later phase. No backfill source today.';

COMMENT ON COLUMN schools.frameworks_in_use_jsonb IS
  'Phase 4.8 — bubbled-up framework list (e.g. ["IB_MYP", "GCSE_DT"]). '
  'NULL until UX populates. No backfill source today.';

COMMENT ON COLUMN schools.default_grading_scale IS
  'Phase 4.8 — school-wide default grading scale. NULL = no default.';

COMMENT ON COLUMN schools.notification_branding_jsonb IS
  'Phase 4.8 — school logo / footer text for notification emails. '
  'NULL = use Loominary defaults.';

COMMENT ON COLUMN schools.safeguarding_contacts_jsonb IS
  'Phase 4.8 — emergency contacts for safeguarding alerts. HIGH-STAKES '
  'change (security boundary — adding fake recipients bypasses '
  'safeguards). Per §3.8 Q2 tier classification.';

COMMENT ON COLUMN schools.content_sharing_default IS
  'Phase 4.8 — default content visibility (school_visible | private). '
  'school_visible = published units appear in school library. '
  'Defaults to school_visible for new rows.';

COMMENT ON COLUMN schools.default_student_ai_budget IS
  'Phase 4.8 — per-school override of the AI token budget cascade. '
  'Phase 5 wires the cascade resolution (tier default → this column '
  '→ class override → student override). NULL = use tier default.';

-- ============================================================
-- 2. Backfill academic_calendar_jsonb from school_calendar_terms
-- ============================================================
-- Strategy: for each school, find the teacher with the most-recently-
-- edited terms and use their term list as the bubble-up source.
-- This matches the "most-recently-edited per school" rule in §4.8 spec.
-- Schools where no teacher has terms keep academic_calendar_jsonb NULL.
--
-- The output JSONB shape is an array of term objects:
--   [{"term_name", "term_order", "academic_year", "start_date",
--     "end_date"}, ...]
-- Sorted by term_order ASC.

WITH most_recent_per_school AS (
  SELECT DISTINCT ON (t.school_id)
    t.school_id AS school_id,
    sct.teacher_id
  FROM school_calendar_terms sct
  JOIN teachers t ON t.id = sct.teacher_id
  WHERE t.school_id IS NOT NULL
  ORDER BY t.school_id, sct.updated_at DESC NULLS LAST, sct.created_at DESC
),
school_terms AS (
  SELECT
    mrp.school_id,
    jsonb_agg(
      jsonb_build_object(
        'term_name', sct.term_name,
        'term_order', sct.term_order,
        'academic_year', sct.academic_year,
        'start_date', sct.start_date,
        'end_date', sct.end_date
      )
      ORDER BY sct.term_order ASC, sct.academic_year DESC
    ) AS terms_jsonb
  FROM most_recent_per_school mrp
  JOIN school_calendar_terms sct ON sct.teacher_id = mrp.teacher_id
  GROUP BY mrp.school_id
)
UPDATE schools s
SET academic_calendar_jsonb = st.terms_jsonb
FROM school_terms st
WHERE s.id = st.school_id
  AND s.academic_calendar_jsonb IS NULL;

-- ============================================================
-- 3. Sanity check
-- ============================================================

DO $$
DECLARE
  v_columns_added INT;
  v_calendar_backfilled INT;
BEGIN
  -- All 8 columns present
  SELECT COUNT(*) INTO v_columns_added
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'schools'
    AND column_name IN (
      'academic_calendar_jsonb',
      'timetable_skeleton_jsonb',
      'frameworks_in_use_jsonb',
      'default_grading_scale',
      'notification_branding_jsonb',
      'safeguarding_contacts_jsonb',
      'content_sharing_default',
      'default_student_ai_budget'
    );
  IF v_columns_added != 8 THEN
    RAISE EXCEPTION 'Migration failed: expected 8 schools columns, found %',
                    v_columns_added;
  END IF;

  -- Calendar backfill — informational. Most prod schools today have
  -- 0 calendar terms (post-three-Matts wipe), so this is likely 0.
  SELECT COUNT(*) INTO v_calendar_backfilled
  FROM schools
  WHERE academic_calendar_jsonb IS NOT NULL;

  RAISE NOTICE 'Migration phase_4_8_schools_settings_columns applied OK: '
               '8 columns added; academic_calendar_jsonb backfilled on '
               '% schools (informational — schools without calendar '
               'terms keep NULL).',
               v_calendar_backfilled;
END $$;
