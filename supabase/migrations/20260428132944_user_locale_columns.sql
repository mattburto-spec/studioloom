-- Migration: user_locale_columns
-- Created: 20260428132944 UTC
-- Phase: Access Model v2 Phase 0.2 (Option A scope — locale only)
--
-- WHY: Adds locale (UI language preference) columns to teachers and
--   students tables. Resolution chain in Phase 1+ session helpers:
--   user.locale ?? school.default_locale ?? 'en'. No translation
--   system in v2 — just the seam. When i18n eventually lands, columns
--   are populated and routes already pass locale through.
-- IMPACT: teachers gains 1 column (locale). students gains 1 column
--   (locale). No RLS changes — column-level access matches row-level.
--   No indexes — locale is per-user PK lookup, never a filter dimension.
-- ROLLBACK: paired .down.sql drops both columns.
--
-- SIS forward-compat columns (originally planned for this migration)
-- are NOT added here. mig 005_lms_integration.sql already added
--   students.external_id, students.external_provider,
--   classes.external_class_id, classes.external_provider,
--   classes.last_synced_at
-- under different names than the access-model-v2 plan called for.
-- Renaming touches every reader of the LMS integration code path
-- and is out of scope for forward-compat-only Phase 0. Canonicalisation
-- deferred to Phase 6 cutover audit (or post-pilot follow-up).
--
-- All defaults are total ('en' for every existing row) so Lesson #38
-- (ADD COLUMN DEFAULT silently overrides conditional UPDATE) doesn't bite.
-- Existing rows get the default uniformly.
--
-- IETF BCP 47 tags (en, en-AU, zh-CN, zh-Hant, etc.) are too varied to
-- enumerate in a CHECK constraint. Validation happens at app layer.

ALTER TABLE teachers
  ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE students
  ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';

-- Sanity check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='teachers' AND column_name='locale'
  ) THEN
    RAISE EXCEPTION 'Migration user_locale_columns failed: teachers.locale missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='students' AND column_name='locale'
  ) THEN
    RAISE EXCEPTION 'Migration user_locale_columns failed: students.locale missing';
  END IF;
  RAISE NOTICE 'Migration user_locale_columns applied OK: 2 columns added';
END $$;
