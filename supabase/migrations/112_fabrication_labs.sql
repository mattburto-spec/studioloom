-- Migration 112: fabrication_labs table + machine_profiles.lab_id
--                  + classes.default_lab_id
--
-- Preflight Phase 8-1. Adds the per-teacher Lab entity + FK columns
-- on existing tables. Backfill of existing rows runs in migration 113.
--
-- Refs:
--   - Spec:     docs/projects/fabrication-pipeline.md §13 Phase 8 + §14
--   - Brief:    docs/projects/preflight-phase-8-1-brief.md
--   - Parent:   docs/projects/preflight-phase-8-brief.md (6 open questions resolved "all recommended")
--   - Lessons:  #24 (idempotent guards), #29 (dual-visibility if students see these), #51 (no DO/DECLARE verify blocks)
--
-- Ownership model:
--   - Every row owned by exactly one teacher (teacher_id NOT NULL).
--   - Cross-teacher sharing explicitly OUT OF SCOPE v1 per §5 Q3 "all recommended".
--   - school_id reserved NULLable for FU-P (access-model-v2) — allows
--     future cross-teacher sharing via school membership without an
--     ALTER TABLE on the hot path.

-- ============================================================
-- 1. Create fabrication_labs table
-- ============================================================

CREATE TABLE IF NOT EXISTS fabrication_labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  UUID NULL REFERENCES schools(id) ON DELETE SET NULL,
    -- reserved for FU-P access-model-v2; NULL in v1

  -- Identity
  name         TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description  TEXT NULL,

  -- Flag for the auto-created default lab per teacher. UI can
  -- distinguish "Default lab" from teacher-named ones (e.g.
  -- "2nd floor design lab"). Enforced single-per-teacher via
  -- unique partial index below.
  is_default   BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fabrication_labs_teacher_id
  ON fabrication_labs(teacher_id);

CREATE INDEX IF NOT EXISTS idx_fabrication_labs_school_id
  ON fabrication_labs(school_id)
  WHERE school_id IS NOT NULL;

-- One default lab per teacher. Enforced at the DB level so:
--   (a) backfill in 113 is safe to re-run — second INSERT for the
--       same teacher+is_default=true will fail on this unique index
--   (b) 8-2's createLab path can't race itself into a multi-default state
CREATE UNIQUE INDEX IF NOT EXISTS uq_fabrication_labs_one_default_per_teacher
  ON fabrication_labs(teacher_id)
  WHERE is_default = true;

-- ============================================================
-- 3. updated_at trigger (shared function from migration 030)
-- ============================================================

DROP TRIGGER IF EXISTS trigger_fabrication_labs_updated_at ON fabrication_labs;
CREATE TRIGGER trigger_fabrication_labs_updated_at
  BEFORE UPDATE ON fabrication_labs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE fabrication_labs ENABLE ROW LEVEL SECURITY;

-- SELECT: teacher sees only their own labs.
-- (No student / fabricator visibility — they interact with machines,
-- which join to labs server-side. The lab concept itself is teacher-
-- facing only. Service role bypasses RLS implicitly — that's how
-- server-side orchestration reads labs transitively.)
DROP POLICY IF EXISTS fabrication_labs_select_teacher ON fabrication_labs;
CREATE POLICY fabrication_labs_select_teacher
  ON fabrication_labs
  FOR SELECT
  USING (teacher_id = auth.uid());

-- INSERT: teacher creates labs owned by themselves
DROP POLICY IF EXISTS fabrication_labs_insert_teacher ON fabrication_labs;
CREATE POLICY fabrication_labs_insert_teacher
  ON fabrication_labs
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

-- UPDATE: teacher edits their own labs
DROP POLICY IF EXISTS fabrication_labs_update_teacher ON fabrication_labs;
CREATE POLICY fabrication_labs_update_teacher
  ON fabrication_labs
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- DELETE: teacher deletes their own labs (8-2 API route will layer
-- on the "reassign machines first or get a 409" safety rail)
DROP POLICY IF EXISTS fabrication_labs_delete_teacher ON fabrication_labs;
CREATE POLICY fabrication_labs_delete_teacher
  ON fabrication_labs
  FOR DELETE
  USING (teacher_id = auth.uid());

-- ============================================================
-- 5. machine_profiles.lab_id — nullable for migration safety
-- ============================================================
--
-- Backfilled in 113. Teacher-owned rows get their default lab's id;
-- system templates stay NULL (they're cross-tenant seeds, not scoped
-- to any lab). `ON DELETE SET NULL` so deleting a lab doesn't cascade
-- into machine rows — machines become "unassigned" and the 8-2
-- delete-lab flow handles reassignment explicitly.

ALTER TABLE machine_profiles
  ADD COLUMN IF NOT EXISTS lab_id UUID NULL
    REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_machine_profiles_lab_id
  ON machine_profiles(lab_id)
  WHERE lab_id IS NOT NULL;

-- ============================================================
-- 6. classes.default_lab_id — nullable for migration safety + legacy
-- ============================================================
--
-- Backfilled in 113. Null-lab fallback is the parent brief's §3.5
-- "if class has no default_lab_id, show all" — student picker keeps
-- working even if a class somehow ends up with a null lab.

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS default_lab_id UUID NULL
    REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_default_lab_id
  ON classes(default_lab_id)
  WHERE default_lab_id IS NOT NULL;
