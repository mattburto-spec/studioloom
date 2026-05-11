-- Migration: student_unit_project_specs
-- Created: 20260511083114 UTC
-- Phase: Project Spec Block v1 — lesson-page activity for G9 design class (12 May 2026)
--
-- WHY: Per-student-per-unit Project Spec state. Backs a new lesson-page
--   activity (`responseType: "project-spec"`) where students pick an
--   archetype (Toy / Architecture for tomorrow's G9 lesson) then walk
--   through 7 questions to produce a structured deliverable card.
--
-- IMPACT:
--   1 NEW table: student_unit_project_specs
--     - One row per (student, unit). UNIQUE(student_id, unit_id).
--     - archetype_id: kebab-case stable string referencing a TS-constant
--       archetype in src/lib/project-spec/archetypes.ts. NOT a FK — no
--       project_archetypes table in v1 (archetype copy lives in code).
--     - slot_1..slot_7: JSONB { value, skipped, updated_at }. Value
--       shape varies by input type (text | chip-picker | size-reference
--       | number-pair) — validated app-side.
--     - completed_at: set when student clicks "CONTINUE TO TIMELINE"
--       (even if some slots were skipped). NULL while in-progress.
--     - class_id: nullable. Helps teacher visibility scoping in v2.
--   2 indexes: (student_id, unit_id) lookup; (unit_id) teacher reads.
--   1 RLS policy: teacher SELECT via class_units join (mirror kanban
--     pattern from AG.2.1). Students access via service-role API
--     (Lesson #4 — token sessions, not auth.uid()).
--
-- DEPENDENCIES:
--   - students, units, classes (existing)
--   - class_units (existing — used by teacher RLS join)
--   - user_profiles (existing — platform-admin escape hatch)
--   - set_updated_at() function (shared trigger pattern)
--
-- ROLLBACK: paired .down.sql drops the table. Safety guard refuses if
--   any row has archetype_id set (student work present).

-- ============================================================
-- 1. student_unit_project_specs — per-student-per-unit Project Spec state
-- ============================================================

CREATE TABLE IF NOT EXISTS student_unit_project_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,
  class_id   UUID REFERENCES classes(id),

  -- Archetype reference. Stable kebab-case string (e.g. 'toy-design',
  -- 'architecture-interior') matching a TS constant in
  -- src/lib/project-spec/archetypes.ts. NULL until Q0 chip picked.
  -- Not a FK — no project_archetypes table in v1.
  archetype_id TEXT,

  -- 7 slot answers. Each: { value, skipped: boolean, updated_at: ISO }.
  -- Value type varies by input: string | string[] | {primary, secondary}
  -- | {ref: string, cm?: [w,h,d]} | {minutes, participants}. Shape
  -- validated in the app layer (Zod schema on PATCH endpoint).
  slot_1 JSONB,
  slot_2 JSONB,
  slot_3 JSONB,
  slot_4 JSONB,
  slot_5 JSONB,
  slot_6 JSONB,
  slot_7 JSONB,

  -- Set when student clicks "CONTINUE TO TIMELINE". Even if some slots
  -- were skipped, completion is explicit. NULL = still in progress.
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(student_id, unit_id)
);

COMMENT ON TABLE student_unit_project_specs IS
  'Project Spec v1 — per-student-per-unit structured intake. One row per '
  '(student, unit). Archetype picker (Q0) + 7-slot walker (Q1-Q7) drive '
  'a deliverable card. Archetype copy lives in TS constants, not DB.';

COMMENT ON COLUMN student_unit_project_specs.archetype_id IS
  'Stable kebab-case archetype key (e.g. toy-design, architecture-interior). '
  'References src/lib/project-spec/archetypes.ts. NULL until student picks.';

COMMENT ON COLUMN student_unit_project_specs.slot_1 IS
  'Slot answer JSONB: { value, skipped: boolean, updated_at: ISO }. '
  'Value shape varies by input type. Same shape for slot_2..slot_7.';

COMMENT ON COLUMN student_unit_project_specs.completed_at IS
  'Set when student clicks CONTINUE TO TIMELINE. NULL while in-progress. '
  'Skipped slots allowed at completion — they render as "Not yet defined".';

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Primary lookup: a single student's spec for one unit
CREATE INDEX IF NOT EXISTS idx_student_unit_project_specs_student_unit
  ON student_unit_project_specs(student_id, unit_id);

-- Teacher dashboard: all specs across a unit's students
CREATE INDEX IF NOT EXISTS idx_student_unit_project_specs_unit
  ON student_unit_project_specs(unit_id);

-- ============================================================
-- 3. RLS — teacher SELECT via class_units join
-- ============================================================
-- Students use custom token sessions (Lesson #4) — student-side reads
-- and writes go through service-role API routes that bypass RLS. No
-- student policy needed.

ALTER TABLE student_unit_project_specs ENABLE ROW LEVEL SECURITY;

-- Teacher read access: teachers who own a class with this unit assigned
-- can read student project specs. Mirrors the AG.2.1 kanban policy
-- (Lesson #72: teachers.id = auth.users.id 1:1).
CREATE POLICY "student_unit_project_specs_teacher_read"
  ON student_unit_project_specs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = student_unit_project_specs.unit_id
        AND cu.is_active = true
        AND c.teacher_id = auth.uid()
    )
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- ============================================================
-- 4. updated_at trigger (reuses shared set_updated_at function)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_unit_project_specs_updated_at
  BEFORE UPDATE ON student_unit_project_specs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. Sanity check
-- ============================================================
DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_index_count INT;
  v_policy_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_unit_project_specs'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: student_unit_project_specs table not created';
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'student_unit_project_specs'
    AND indexname LIKE 'idx_%';
  IF v_index_count < 2 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 2 indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'student_unit_project_specs';
  IF v_policy_count < 1 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 1 RLS policy, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration student_unit_project_specs applied OK: 1 new table, % indexes, % RLS policies',
               v_index_count, v_policy_count;
END $$;
