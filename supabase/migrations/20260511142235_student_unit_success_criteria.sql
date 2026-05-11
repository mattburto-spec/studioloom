-- Migration: student_unit_success_criteria
-- Created: 20260511142235 UTC
-- Phase: Project Spec v2 Phase A.3 — schema for "Success Criteria" lesson-page activity
--
-- WHY: Third of three v2 tables. UNIVERSAL across archetypes. Replaces
--   v1's single Q7 ("your test goes well if...") with 5 slots covering
--   observable signal, measurement protocol, test setup, failure mode,
--   iteration trigger. Pedagogically: teaches students to think like
--   researchers, not designers — plan logistics + decide failure modes
--   before building.
--
-- IMPACT:
--   1 NEW table: student_unit_success_criteria
--     - One row per (student, unit). UNIQUE(student_id, unit_id).
--     - No archetype_id — universal.
--     - slot_1..slot_5: JSONB { value, skipped, updated_at }.
--   2 indexes: (student_id, unit_id) lookup; (unit_id) teacher reads.
--   1 RLS policy: teacher SELECT via class_units join (mirrors v1).
--
-- DEPENDENCIES: students, units, classes, class_units, user_profiles,
--   set_updated_at() function.
--
-- ROLLBACK: paired .down.sql drops the table. Safety guard refuses if
--   any row has slot_1 set (= success signal, canonical work indicator).

CREATE TABLE IF NOT EXISTS student_unit_success_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,
  class_id   UUID REFERENCES classes(id),

  -- 5 slot answers. Shape: { value: SlotValue, skipped: boolean, updated_at: ISO }.
  -- Slot semantics (see docs/projects/project-spec-v2-split-brief.md §4):
  --   slot_1 — Observable success signal (text, 20 words)
  --   slot_2 — Measurement protocol (chip-picker: timed / counted / qualitative / before-after / scale-rating)
  --   slot_3 — Test setup (text-multifield, 4 fields: where / when / how long / who watches)
  --   slot_4 — Failure mode (text, 25 words)
  --   slot_5 — Iteration trigger (text, 20 words)
  slot_1 JSONB,
  slot_2 JSONB,
  slot_3 JSONB,
  slot_4 JSONB,
  slot_5 JSONB,

  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(student_id, unit_id)
);

COMMENT ON TABLE student_unit_success_criteria IS
  'Project Spec v2 — Success Criteria lesson-page activity. Universal '
  'across archetypes. One row per (student, unit). 5 slots covering '
  'observable signal, measurement, test setup, failure mode, iteration.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_unit_success_criteria_student_unit
  ON student_unit_success_criteria(student_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_student_unit_success_criteria_unit
  ON student_unit_success_criteria(unit_id);

-- RLS — teacher SELECT only; students use service-role API
ALTER TABLE student_unit_success_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_unit_success_criteria_teacher_read"
  ON student_unit_success_criteria FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = student_unit_success_criteria.unit_id
        AND cu.is_active = true
        AND c.teacher_id = auth.uid()
    )
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_unit_success_criteria_updated_at
  BEFORE UPDATE ON student_unit_success_criteria
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
    WHERE table_schema = 'public' AND table_name = 'student_unit_success_criteria'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: student_unit_success_criteria table not created';
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'student_unit_success_criteria'
    AND indexname LIKE 'idx_%';
  IF v_index_count < 2 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 2 indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'student_unit_success_criteria';
  IF v_policy_count < 1 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 1 RLS policy, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration student_unit_success_criteria applied OK: 1 table, % indexes, % RLS policies',
               v_index_count, v_policy_count;
END $$;
