-- Migration 117: reserve classes.school_id for FU-P access-model-v2
--
-- Closes the last schema-reservation gap for FU-P. Mirrors the
-- pattern from migrations 093 (machine_profiles), 097 + 116
-- (fabricators), and 113 (fabrication_labs).
--
-- The `classes` table predates the multi-tenant story (mig 001) and
-- never got a school_id. FU-P-1 needs to backfill this column from
-- school_memberships (via teacher's email-domain heuristic). Adding
-- the column now means the FU-P-1 migration is purely INSERT INTO
-- school_memberships + UPDATE classes SET school_id = ..., not
-- ALTER TABLE classes ADD COLUMN.
--
-- Refs:
--   - Brief:  docs/projects/fu-p-access-model-v2-plan.md (revised 25 Apr PM)
--   - Phase 8 checkpoint: docs/projects/preflight-phase-8-checkpoint-8-1.md
--   - Sister migrations:
--       093 — machine_profiles.school_id (reserved Phase 1A)
--       097 — fabricators.school_id (reserved Phase 1A)
--       113 — fabrication_labs.school_id (reserved Phase 8-1)
--       116 — fabricators.school_id index (added Phase 8.1d-3)
--   - Lessons: #51 (no DO/DECLARE verify blocks)
--
-- Behaviour change v1: ZERO. The column is NULL on every existing
-- row + every new row until FU-P backfills it via the teacher's
-- school membership. RLS policies on `classes` (existing per-teacher
-- scoping via `teacher_id = auth.uid()`) stay untouched. FU-P-2
-- rewrites them in a single transaction when that phase opens.

-- ============================================================
-- 1. Add nullable FK column
-- ============================================================
--
-- ON DELETE SET NULL — same pattern as the other school_id
-- reservations. If a school is deleted (admin cleanup), classes
-- stay alive but become school-orphaned. FU-P-2's RLS rewrite will
-- need to handle that edge case explicitly (probably: classes with
-- null school_id are visible only to their teacher_id, falling back
-- to current behaviour).

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS school_id UUID NULL
    REFERENCES schools(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Partial index — only useful when populated (FU-P onward)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_classes_school_id
  ON classes(school_id)
  WHERE school_id IS NOT NULL;

-- ============================================================
-- 3. (deliberately no RLS changes here)
-- ============================================================
-- Existing classes_select_teacher / insert / update / delete policies
-- keep working. FU-P-2 will drop + replace them with school-membership-
-- scoped versions. See fu-p-access-model-v2-plan.md §FU-P-2.
