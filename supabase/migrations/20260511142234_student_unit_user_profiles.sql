-- Migration: student_unit_user_profiles
-- Created: 20260511142234 UTC
-- Phase: Project Spec v2 Phase A.2 — schema for "User Profile" lesson-page activity
--
-- WHY: Second of three v2 tables. UNIVERSAL across archetypes — every
--   project has a user. Replaces v1's anaemic single Q6 ("test user
--   name + relationship") with 8 slots covering age band, context,
--   problem, alternatives, value, optional photo, optional quote.
--   Pedagogically: this is where real empathy work lives.
--
-- IMPACT:
--   1 NEW table: student_unit_user_profiles
--     - One row per (student, unit). UNIQUE(student_id, unit_id).
--     - No archetype_id — universal across all unit types.
--     - slot_1..slot_8: JSONB { value, skipped, updated_at }.
--     - slot_7 carries optional image upload URL (proxy bucket path).
--   2 indexes: (student_id, unit_id) lookup; (unit_id) teacher reads.
--   1 RLS policy: teacher SELECT via class_units join (mirrors v1).
--
-- DEPENDENCIES: students, units, classes, class_units, user_profiles,
--   set_updated_at() function.
--
-- ROLLBACK: paired .down.sql drops the table. Safety guard refuses if
--   any row has slot_1 set (= canonical "row has student work" signal).

CREATE TABLE IF NOT EXISTS student_unit_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,
  class_id   UUID REFERENCES classes(id),

  -- 8 slot answers. Shape: { value: SlotValue, skipped: boolean, updated_at: ISO }.
  -- Slot semantics (see docs/projects/project-spec-v2-split-brief.md §4):
  --   slot_1 — User name + relationship (text, 60 chars)
  --   slot_2 — Age band (chip-picker: 0-5 / 6-10 / 11-14 / 15-18 / adult / mixed)
  --   slot_3 — Where & when used (text, 30 words)
  --   slot_4 — Problem they're solving (text, 30 words)
  --   slot_5 — What exists + why it doesn't fit (text-multifield, 2 fields)
  --   slot_6 — Why they'd care about your version (text, 25 words)
  --   slot_7 — Photo / sketch (optional, image-upload, proxy-bucket URL)
  --   slot_8 — Quote / observation (optional text, 40 words)
  slot_1 JSONB,
  slot_2 JSONB,
  slot_3 JSONB,
  slot_4 JSONB,
  slot_5 JSONB,
  slot_6 JSONB,
  slot_7 JSONB,
  slot_8 JSONB,

  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(student_id, unit_id)
);

COMMENT ON TABLE student_unit_user_profiles IS
  'Project Spec v2 — User Profile lesson-page activity. Universal across '
  'archetypes. One row per (student, unit). 8 slots; slot_7 carries an '
  'optional image URL. Pedagogical anchor for empathy work.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_unit_user_profiles_student_unit
  ON student_unit_user_profiles(student_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_student_unit_user_profiles_unit
  ON student_unit_user_profiles(unit_id);

-- RLS — teacher SELECT only; students use service-role API
ALTER TABLE student_unit_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_unit_user_profiles_teacher_read"
  ON student_unit_user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = student_unit_user_profiles.unit_id
        AND cu.is_active = true
        AND c.teacher_id = auth.uid()
    )
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- updated_at trigger (function shared, CREATE OR REPLACE idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_unit_user_profiles_updated_at
  BEFORE UPDATE ON student_unit_user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sanity check
DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_index_count INT;
  v_policy_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_unit_user_profiles'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: student_unit_user_profiles table not created';
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'student_unit_user_profiles'
    AND indexname LIKE 'idx_%';
  IF v_index_count < 2 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 2 indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'student_unit_user_profiles';
  IF v_policy_count < 1 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 1 RLS policy, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration student_unit_user_profiles applied OK: 1 table, % indexes, % RLS policies',
               v_index_count, v_policy_count;
END $$;
