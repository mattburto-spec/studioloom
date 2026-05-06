-- Migration: student_unit_kanban_v1
-- Created: 20260506000324 UTC
-- Phase: AG.2.1 — Kanban tool foundation for the CO2 Racers agency unit
--
-- WHY: Per-student-per-unit Kanban board state. Powers the project-management
--   surface students see at start + end of each studio class. Drives the
--   teacher's Attention-Rotation Panel (AG.4) via denormalized count columns
--   + last_move_at staleness signal. Drives the AG.8 dashboard cards via
--   the same denormalized counts (cheap summary view, no JSONB parse).
--
-- IMPACT:
--   1 NEW table: student_unit_kanban
--     - One row per (student, unit). UNIQUE(student_id, unit_id).
--     - Cards stored as JSONB array (variable length, ordered).
--     - Denormalized counts: backlog/this_class/doing/done — updated on
--       every save. Enables cheap dashboard queries without rehydrating.
--     - WIP limit per Cowork pedagogical research: doing column max 1
--       (range 1-3 to allow teacher tweaking; default 1).
--     - last_move_at: ISO timestamp of last card status change. Drives
--       attention-rotation "stale Kanban" detection.
--   3 indexes: (student_id, unit_id) for direct lookup; (unit_id) for
--     teacher dashboard reads; partial index on last_move_at for
--     attention-rotation queries.
--   1 RLS policy: teacher reads in same school via class_units join.
--     Student auth uses token sessions (Lesson #4); reads/writes go
--     through service-role API routes that bypass RLS.
--
-- DEPENDENCIES:
--   - students, units (existing 001_initial_schema.sql)
--   - class_units, classes (existing — used by RLS policy)
--   - teachers (Lesson #72 — teachers.id = auth.users.id 1:1)
--   - set_updated_at() function (shared trigger pattern)
--
-- ROLLBACK: paired .down.sql drops the table. CASCADE on FKs cleans up
--   any accumulated cards. Refuses if production has accumulated
--   non-trivial rows (defensive guard against losing student work).

-- ============================================================
-- 1. student_unit_kanban — per-student-per-unit Kanban board state
-- ============================================================

CREATE TABLE IF NOT EXISTS student_unit_kanban (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,

  -- Cards array. Each card: { id, title, status, dod, estimateMinutes,
  -- actualMinutes, blockType, blockedAt, becauseClause, lessonLink,
  -- source, createdAt, movedAt, doneAt }. Shape validated in app layer
  -- (TypeScript + reducer); JSONB at DB layer for flexibility.
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Denormalized counts — updated by app on every save. Enable cheap
  -- summary queries without rehydrating cards array. Updated atomically
  -- in the same transaction as cards. CHECK constraints guard against
  -- drift (counts must be non-negative).
  backlog_count    INTEGER NOT NULL DEFAULT 0 CHECK (backlog_count    >= 0),
  this_class_count INTEGER NOT NULL DEFAULT 0 CHECK (this_class_count >= 0),
  doing_count      INTEGER NOT NULL DEFAULT 0 CHECK (doing_count      >= 0),
  done_count       INTEGER NOT NULL DEFAULT 0 CHECK (done_count       >= 0),

  -- WIP limit on the Doing column. Cowork's pedagogical research argues
  -- for 1 (cognitive load + adolescent task-switching cost). Range 1-3
  -- to allow teacher tweak per cohort. Enforced server-side in the
  -- POST /api/student/kanban handler before write.
  wip_limit_doing INTEGER NOT NULL DEFAULT 1
    CHECK (wip_limit_doing BETWEEN 1 AND 3),

  -- Drives Attention-Rotation Panel (AG.4) "stale Kanban" detection.
  -- Updated atomically when any card's status changes. NULL when the
  -- board has never been touched (just created from defaults).
  last_move_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(student_id, unit_id)
);

COMMENT ON TABLE student_unit_kanban IS
  'AG.2 — per-student-per-unit Kanban board for project management. '
  'One row per (student, unit). Cards as JSONB array; counts denormalized '
  'for cheap summary queries (dashboard cards in AG.8, attention rotation '
  'in AG.4). WIP limit on Doing default 1 per Cowork research.';

COMMENT ON COLUMN student_unit_kanban.cards IS
  'Card array. Shape: { id, title, status, dod, estimateMinutes, '
  'actualMinutes, blockType, blockedAt, becauseClause, lessonLink, '
  'source, createdAt, movedAt, doneAt }. Validated in app layer.';

COMMENT ON COLUMN student_unit_kanban.wip_limit_doing IS
  'WIP limit on Doing column. Default 1 ("finish before you start"). '
  'Range 1-3. Enforced server-side in POST handler.';

COMMENT ON COLUMN student_unit_kanban.last_move_at IS
  'ISO timestamp of last card status change. NULL if board untouched. '
  'Drives Attention-Rotation Panel staleness detection (AG.4).';

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Primary lookup: single student's kanban for one unit
CREATE INDEX IF NOT EXISTS idx_student_unit_kanban_student_unit
  ON student_unit_kanban(student_id, unit_id);

-- Teacher dashboard: all kanbans across a unit's students
CREATE INDEX IF NOT EXISTS idx_student_unit_kanban_unit
  ON student_unit_kanban(unit_id);

-- Attention-rotation staleness query: order by last_move_at DESC NULLS LAST
-- Partial index excludes never-touched boards (NULL) — those handled separately
CREATE INDEX IF NOT EXISTS idx_student_unit_kanban_last_move
  ON student_unit_kanban(unit_id, last_move_at DESC NULLS LAST)
  WHERE last_move_at IS NOT NULL;

-- ============================================================
-- 3. RLS — teacher read in same school via class_units join
-- ============================================================
-- Students use custom token sessions (Lesson #4) — student-side reads
-- and writes go through service-role API routes that bypass RLS. The
-- token session is verified at the API layer via requireStudentSession;
-- no SELECT/INSERT/UPDATE policy needed for students under this auth.
-- Service-role bypass is the correct path here.

ALTER TABLE student_unit_kanban ENABLE ROW LEVEL SECURITY;

-- Teacher read access: teachers who own a class with this unit assigned
-- can read student kanbans. Mirrors assessment_tasks_read_school pattern
-- from TG.0B (Lesson #72: teachers.id = auth.users.id 1:1).
CREATE POLICY "student_unit_kanban_teacher_read"
  ON student_unit_kanban FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = student_unit_kanban.unit_id
        AND cu.is_active = true
        AND c.teacher_id = auth.uid()
    )
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- ============================================================
-- 4. updated_at trigger (reuses shared set_updated_at function)
-- ============================================================
-- set_updated_at() is the canonical pattern from prior migrations
-- (e.g. TG.0B 20260505032750). Reuse don't redefine — but we
-- CREATE OR REPLACE for safety in case this migration runs first
-- in a fresh environment.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_unit_kanban_updated_at
  BEFORE UPDATE ON student_unit_kanban
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
    WHERE table_schema = 'public' AND table_name = 'student_unit_kanban'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: student_unit_kanban table not created';
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'student_unit_kanban'
    AND indexname LIKE 'idx_%';
  IF v_index_count < 3 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 3 indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'student_unit_kanban';
  IF v_policy_count < 1 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 1 RLS policy, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration student_unit_kanban_v1 applied OK: 1 new table, % indexes, % RLS policies',
               v_index_count, v_policy_count;
END $$;
