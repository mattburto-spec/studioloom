-- Migration: student_unit_timeline_v1
-- Created: 20260506010518 UTC
-- Phase: AG.3.1 — Timeline tool foundation for the CO2 Racers agency unit
--
-- WHY: Per-student-per-unit Timeline state. Backward-mapped milestones
--   (Day 1 use case — drag from race-day to today) + per-class forward
--   planning (which milestones land each class). Drives the AG.4
--   Attention-Rotation Panel via lastUpdatedAt staleness + variance
--   computation. Drives AG.8 dashboard TimelineCard via denormalized
--   "next milestone" summary.
--
-- IMPACT:
--   1 NEW table: student_unit_timeline
--     - One row per (student, unit). UNIQUE(student_id, unit_id).
--     - Milestones JSONB array (variable length, ordered). Each milestone:
--       { id, label, targetDate, status: 'pending'|'done', doneAt,
--         order, isAnchor }
--     - race_date DATE (informational; teachers may set when authoring)
--     - 4 denormalized summary columns: next_milestone_label,
--       next_milestone_target_date, pending_count, done_count.
--       Updated on every save so dashboard queries don't parse JSONB.
--     - last_updated_at TIMESTAMPTZ (Attention-Rotation staleness).
--   3 indexes: (student_id, unit_id) for direct lookup; (unit_id) for
--     teacher dashboard reads; partial on next_milestone_target_date
--     for upcoming-milestone queries.
--   1 RLS policy: teacher_read via class_units → classes.teacher_id.
--     Students use service-role API routes via token sessions
--     (Lesson #4); RLS bypass is correct.
--
-- DEPENDENCIES:
--   - students, units (existing 001_initial_schema.sql)
--   - class_units, classes (used by RLS policy)
--   - teachers (Lesson #72 — teachers.id = auth.users.id 1:1)
--   - set_updated_at() (shared trigger function)
--
-- ROLLBACK: paired .down.sql refuses if any row has non-empty milestones
--   (student work protection). Same pattern as student_unit_kanban_v1.

-- ============================================================
-- 1. student_unit_timeline — per-student-per-unit Timeline state
-- ============================================================

CREATE TABLE IF NOT EXISTS student_unit_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,

  -- Milestones array. Each milestone:
  --   { id (UUID), label (text), targetDate (ISO date or null),
  --     status ('pending' | 'done'), doneAt (ISO timestamp or null),
  --     order (integer), isAnchor (bool, default false) }
  -- Shape validated in app layer. JSONB at DB layer for flexibility.
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Optional fixed race-day anchor. Informational; UI may or may not
  -- treat this specially. Per-unit constant — set once when student
  -- first opens the timeline (or seeded from teacher unit config).
  race_date DATE,

  -- Denormalized summary columns — drive AG.8 dashboard TimelineCard
  -- + AG.4 attention-rotation queries without rehydrating milestones.
  -- Updated atomically by app on every save.
  next_milestone_label       TEXT,
  next_milestone_target_date DATE,
  pending_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_count >= 0),
  done_count    INTEGER NOT NULL DEFAULT 0 CHECK (done_count    >= 0),

  -- Drives Attention-Rotation Panel (AG.4) staleness detection.
  -- Updated atomically when any milestone changes. NULL when the
  -- timeline has never been touched (just created from defaults).
  last_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(student_id, unit_id)
);

COMMENT ON TABLE student_unit_timeline IS
  'AG.3 — per-student-per-unit Timeline of milestones. One row per '
  '(student, unit). Milestones as JSONB array; counts + next-milestone '
  'denormalized for cheap dashboard queries (AG.8) + attention rotation '
  '(AG.4). Variance (on-track/tight/behind) computed at read time '
  'against now().';

COMMENT ON COLUMN student_unit_timeline.milestones IS
  'Milestone array. Shape: { id, label, targetDate, status, doneAt, '
  'order, isAnchor }. status: pending | done. Validated in app layer.';

COMMENT ON COLUMN student_unit_timeline.next_milestone_target_date IS
  'Target date of the earliest pending milestone with a non-null target. '
  'Powers dashboard TimelineCard "due in N days" rendering. Null when '
  'no pending milestones have target dates set.';

COMMENT ON COLUMN student_unit_timeline.last_updated_at IS
  'ISO timestamp of last milestone change. NULL if untouched. Drives '
  'Attention-Rotation Panel staleness detection (AG.4).';

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Primary lookup: single student's timeline for one unit
CREATE INDEX IF NOT EXISTS idx_student_unit_timeline_student_unit
  ON student_unit_timeline(student_id, unit_id);

-- Teacher dashboard: all timelines across a unit's students
CREATE INDEX IF NOT EXISTS idx_student_unit_timeline_unit
  ON student_unit_timeline(unit_id);

-- Upcoming-milestone queries: order by target date ascending
-- Partial index excludes timelines with no upcoming target
CREATE INDEX IF NOT EXISTS idx_student_unit_timeline_next_target
  ON student_unit_timeline(unit_id, next_milestone_target_date ASC NULLS LAST)
  WHERE next_milestone_target_date IS NOT NULL;

-- ============================================================
-- 3. RLS — teacher read via class_units join (mirrors AG.2 Kanban)
-- ============================================================
-- Students use custom token sessions (Lesson #4) — student-side reads
-- and writes go through service-role API routes that bypass RLS. The
-- token session is verified at the API layer via requireStudentSession.

ALTER TABLE student_unit_timeline ENABLE ROW LEVEL SECURITY;

-- Teacher read access via class_units → classes.teacher_id (Lesson #72:
-- teachers.id IS auth.users.id 1:1).
CREATE POLICY "student_unit_timeline_teacher_read"
  ON student_unit_timeline FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = student_unit_timeline.unit_id
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

CREATE TRIGGER trigger_student_unit_timeline_updated_at
  BEFORE UPDATE ON student_unit_timeline
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
    WHERE table_schema = 'public' AND table_name = 'student_unit_timeline'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: student_unit_timeline table not created';
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'student_unit_timeline'
    AND indexname LIKE 'idx_%';
  IF v_index_count < 3 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 3 indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'student_unit_timeline';
  IF v_policy_count < 1 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 1 RLS policy, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration student_unit_timeline_v1 applied OK: 1 new table, % indexes, % RLS policies',
               v_index_count, v_policy_count;
END $$;
