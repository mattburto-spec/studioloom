-- Migration: student_unit_product_briefs
-- Created: 20260511142232 UTC
-- Phase: Project Spec v2 Phase A.1 — schema for "Product Brief" lesson-page activity
--
-- WHY: First of three new tables splitting v1's unified Project Spec
--   into three focused blocks (Product Brief / User Profile / Success
--   Criteria). Product Brief is archetype-driven (Toy / Architecture in
--   v2.0, expanding via FU-PSV2-ARCHETYPES-3-6). Adds 4 new authoring
--   surfaces beyond v1's Q1-Q5: precedents, constraints, technical
--   risks, plus an optional secondary material chip.
--
-- IMPACT:
--   1 NEW table: student_unit_product_briefs
--     - One row per (student, unit). UNIQUE(student_id, unit_id).
--     - archetype_id: kebab-case stable string matching the v1 ARCHETYPES
--       registry in src/lib/project-spec/archetypes.ts. NOT a FK — no
--       project_archetypes table.
--     - slot_1..slot_9: JSONB { value, skipped, updated_at } answers.
--       Shape varies by input type; validated app-side.
--     - completed_at: set on explicit "Finish" click; skipped slots OK.
--     - class_id: nullable, scoped for future teacher-class views.
--   2 indexes: (student_id, unit_id) lookup; (unit_id) teacher reads.
--   1 RLS policy: teacher SELECT via class_units join (mirrors v1).
--     Students access via service-role API (Lesson #4 — token sessions).
--
-- DEPENDENCIES:
--   - students, units, classes (existing)
--   - class_units (existing — used by teacher RLS join)
--   - user_profiles (existing — platform-admin escape hatch)
--   - set_updated_at() function (shared trigger pattern)
--
-- ROLLBACK: paired .down.sql drops the table. Safety guard refuses if
--   any row has archetype_id set (= student work present).

CREATE TABLE IF NOT EXISTS student_unit_product_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,
  class_id   UUID REFERENCES classes(id),

  archetype_id TEXT,

  -- 9 slot answers. Shape: { value: SlotValue, skipped: boolean, updated_at: ISO }.
  -- Slot semantics (see docs/projects/project-spec-v2-split-brief.md §4):
  --   slot_1 — Project name (text, 4 words)
  --   slot_2 — Elevator pitch (text, 25 words)
  --   slot_3 — Core mechanism (text, 15 words)
  --   slot_4 — Primary material (chip-picker, MATERIALS_CHIPS)
  --   slot_5 — Secondary material (chip-picker, MATERIALS_CHIPS, optional)
  --   slot_6 — Scale (size-reference for Toy / number-pair for Architecture)
  --   slot_7 — Constraints (multi-chip: time / cost / ethical / weight / safety / accessibility)
  --   slot_8 — Precedents (text + optional image URL)
  --   slot_9 — Technical risks (text-multifield, 1-3 fields)
  slot_1 JSONB,
  slot_2 JSONB,
  slot_3 JSONB,
  slot_4 JSONB,
  slot_5 JSONB,
  slot_6 JSONB,
  slot_7 JSONB,
  slot_8 JSONB,
  slot_9 JSONB,

  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(student_id, unit_id)
);

COMMENT ON TABLE student_unit_product_briefs IS
  'Project Spec v2 — Product Brief lesson-page activity. One row per '
  '(student, unit). Archetype picker (Q0) + 9-slot walker drives a '
  'product spec card. Archetype copy + slot defs live in TS source.';

COMMENT ON COLUMN student_unit_product_briefs.archetype_id IS
  'Stable kebab-case archetype key (e.g. toy-design, architecture-interior). '
  'References src/lib/project-spec/archetypes.ts. NULL until student picks.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_unit_product_briefs_student_unit
  ON student_unit_product_briefs(student_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_student_unit_product_briefs_unit
  ON student_unit_product_briefs(unit_id);

-- RLS — teacher SELECT only; students use service-role API (Lesson #4)
ALTER TABLE student_unit_product_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_unit_product_briefs_teacher_read"
  ON student_unit_product_briefs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = student_unit_product_briefs.unit_id
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

CREATE TRIGGER trigger_student_unit_product_briefs_updated_at
  BEFORE UPDATE ON student_unit_product_briefs
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
    WHERE table_schema = 'public' AND table_name = 'student_unit_product_briefs'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: student_unit_product_briefs table not created';
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'student_unit_product_briefs'
    AND indexname LIKE 'idx_%';
  IF v_index_count < 2 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 2 indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'student_unit_product_briefs';
  IF v_policy_count < 1 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 1 RLS policy, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration student_unit_product_briefs applied OK: 1 table, % indexes, % RLS policies',
               v_index_count, v_policy_count;
END $$;
