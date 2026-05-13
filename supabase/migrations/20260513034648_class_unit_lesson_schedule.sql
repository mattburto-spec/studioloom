-- Migration: class_unit_lesson_schedule
-- Created: 20260513034648 UTC
-- Phase: Tier 2 lesson scheduling — per-class lesson dates so Teaching
--        Mode can auto-jump to today's class (or closest) instead of
--        always defaulting to lesson 1.
--
-- WHY: Matt's smoke (13 May 2026): teachers type dates into lesson
--   titles ("Class 3 — Studio (13 May)") as a workaround, but Teaching
--   Mode always opens at Class 1, forcing a manual click each time.
--   Per-class scheduling is the right shape because the same unit may
--   be taught to G8 + G9 + future cohorts at different paces.
--
-- IMPACT:
--   1 NEW table: class_unit_lesson_schedule
--     - One row per (class_id, page_id).
--     - scheduled_date DATE — when this lesson is taught for this class.
--     - Updates via PUT /api/teacher/classes/[classId]/lesson-schedule.
--   2 indexes: (class_id, unit_id) for the lookup; (scheduled_date) for
--     forthcoming countdown queries (FU-FM-RACE-DAY-COUNTDOWN can read
--     the last scheduled_date as race day).
--   1 RLS policy: teacher SELECT/INSERT/UPDATE/DELETE via classes
--     ownership join (mirrors the canonical class-scoped pattern).
--
-- DEPENDENCIES:
--   - classes (existing) — teacher ownership pivot
--   - units (existing) — FK reference
--   - page_id is TEXT, not UUID (page IDs are "page-{ts}-{nanoid}"
--     strings on units.content_data.pages[].id)
--
-- ROLLBACK: paired .down.sql drops the table. Safety guard refuses if
--   any rows exist (= teacher scheduling work would be lost).

CREATE TABLE IF NOT EXISTS class_unit_lesson_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  page_id         TEXT NOT NULL,
  scheduled_date  DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, page_id)
);

COMMENT ON TABLE class_unit_lesson_schedule IS
  'Per-class scheduled date for each lesson page in a unit. Teaching '
  'Mode reads this to auto-jump to today''s lesson. Tier 2 of the '
  'lesson-scheduling spec (13 May 2026 — Matt smoke).';

COMMENT ON COLUMN class_unit_lesson_schedule.page_id IS
  'TEXT page identifier from units.content_data.pages[].id '
  '(format: page-{timestamp}-{nanoid}). Not a UUID.';

-- Indexes
CREATE INDEX IF NOT EXISTS class_unit_lesson_schedule_class_unit_idx
  ON class_unit_lesson_schedule(class_id, unit_id);
CREATE INDEX IF NOT EXISTS class_unit_lesson_schedule_date_idx
  ON class_unit_lesson_schedule(scheduled_date);

-- RLS — teacher-owns-class via classes join
ALTER TABLE class_unit_lesson_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_unit_lesson_schedule_teacher_all"
  ON class_unit_lesson_schedule FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_unit_lesson_schedule.class_id
        AND c.teacher_id = auth.uid()
    )
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_unit_lesson_schedule.class_id
        AND c.teacher_id = auth.uid()
    )
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- updated_at trigger (reuses the shared set_updated_at function)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_class_unit_lesson_schedule_updated_at
  BEFORE UPDATE ON class_unit_lesson_schedule
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
    WHERE table_schema = 'public' AND table_name = 'class_unit_lesson_schedule'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: class_unit_lesson_schedule table not created';
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'class_unit_lesson_schedule'
    AND indexname LIKE '%_idx';
  IF v_index_count < 2 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 2 indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'class_unit_lesson_schedule';
  IF v_policy_count < 1 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 1 RLS policy, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration class_unit_lesson_schedule applied OK: 1 table, % indexes, % RLS policies',
    v_index_count, v_policy_count;
END $$;
