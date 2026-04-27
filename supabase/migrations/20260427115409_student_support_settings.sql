-- Migration: student_support_settings
-- Created: 20260427115409 UTC
--
-- WHY: Phase 2.5 of language-scaffolding-redesign needs teacher-controllable
-- per-student + per-class overrides for tap-a-word features (and future
-- support features). Authority model (Q1 locked): student is source of truth
-- (via learning_profile intake), teacher overrides per-context. Scope (Q2):
-- per-student default + per-class override. JSONB columns let us add future
-- settings (hint defaults, response-starters enabled, etc.) without further
-- migrations.
--
-- IMPACT:
-- - students.support_settings JSONB DEFAULT '{}'::jsonb NOT NULL
-- - class_students.support_settings JSONB DEFAULT '{}'::jsonb NOT NULL
-- Both default to empty object — Phase 2.5 ships with two recognised keys:
--   l1_target_override: 'en'|'zh'|'ko'|'ja'|'es'|'fr'|null
--   tap_a_word_enabled: boolean|null
-- null at any level means "no override — fall back to next level in
-- precedence chain". Server-side resolver merges school→student→class.
--
-- ROLLBACK: paired .down.sql drops both columns.
--
-- LESSON #38: ADD COLUMN with a CONSTANT (non-row-dependent) DEFAULT is
-- safe — every row gets the same '{}'::jsonb. There is no conditional
-- backfill in this migration, so the Lesson #38 trap (DEFAULT shadowing
-- conditional UPDATE) doesn't apply.
--
-- LESSON #51: no DO $$ DECLARE ... $$ verify block — variable names could
-- collide with the Supabase dashboard's RLS-enable parser. Verify queries
-- below are runnable post-apply as plain SELECTs.
--
-- LESSON #52: not applicable — no functions created.
--
-- RLS: existing students + class_students RLS policies cover the new
-- columns automatically (RLS is per-row, not per-column). Teacher writes
-- via API routes use createAdminClient() (service_role) which bypasses
-- RLS. Students reading their own settings via existing channels (e.g.
-- via the resolver) also covered.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS support_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE class_students
  ADD COLUMN IF NOT EXISTS support_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Post-apply verify (run as plain SELECTs in Supabase SQL editor):
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'students' AND column_name = 'support_settings';
--     -- Expected: jsonb | '{}'::jsonb | NO
--
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'class_students' AND column_name = 'support_settings';
--     -- Expected: jsonb | '{}'::jsonb | NO
--
--   SELECT count(*) FROM students WHERE support_settings = '{}'::jsonb;
--     -- Expected: == count(*) on students (every existing row defaults to {})
--
--   SELECT count(*) FROM class_students WHERE support_settings = '{}'::jsonb;
--     -- Expected: == count(*) on class_students
