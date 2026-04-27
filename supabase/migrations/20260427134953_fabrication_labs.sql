-- Migration: fabrication_labs
-- Created: 20260427134953 UTC
-- Phase: Preflight Phase 8-1 (school-scoped lab ownership)
--
-- WHY: Phase 8 introduces fabrication_labs as the unit of physical-space
--   ownership for printers + cutters. v1 had machines owned per-teacher,
--   which doesn't model real schools (a lab is a room, multiple teachers
--   teach there). This migration adds the school-owned labs entity +
--   the connecting columns on machines/classes/teachers, and a
--   school-scoped RLS policy set so any teacher at a school sees + edits
--   the same labs without setup. Audit-only created_by_teacher_id keeps
--   the "added by Cynthia" provenance, but doesn't gate access.
--
-- IMPACT:
--   NEW TABLE fabrication_labs (school-owned, audit creator)
--   ADD COLUMN machine_profiles.lab_id        (FK, nullable, backfilled)
--   ADD COLUMN classes.default_lab_id          (FK, nullable, backfilled)
--   ADD COLUMN teachers.default_lab_id         (FK, nullable, backfilled)
--   NEW FUNCTION current_teacher_school_id()   (SECURITY DEFINER helper)
--   4 RLS policies on fabrication_labs (school-scoped read/write)
--
-- ROLLBACK: paired .down.sql drops everything in reverse order.
--
-- DEPS: 001 (teachers, classes), 085 (schools, teachers.school_id),
--       093 (machine_profiles + update_updated_at_column trigger fn).
--
-- BRIEF: docs/projects/preflight-phase-8-1-brief.md §4.1

-- ============================================================
-- 1. fabrication_labs — owned by SCHOOL, not by individual teacher
-- ============================================================

CREATE TABLE fabrication_labs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership / visibility scope. Every teacher with the same
  -- school_id sees + edits the same labs. NOT NULL — orphan
  -- system accounts (school_id IS NULL) MUST NOT have lab rows
  -- (backfill explicitly excludes them).
  school_id                UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,

  -- Audit only — who created the row. Does NOT gate access. Used
  -- by the lab-setup page to show "added by Cynthia" in the UI.
  -- ON DELETE SET NULL: if Matt's row is ever deleted, the lab he
  -- created stays — it belongs to the school, not him. Audit
  -- trail loses his name (becomes NULL = "unknown teacher"),
  -- which is the desired behaviour.
  created_by_teacher_id    UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,

  name                     TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description              TEXT NULL,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fabrication_labs_school
  ON fabrication_labs(school_id);

CREATE INDEX idx_fabrication_labs_created_by
  ON fabrication_labs(created_by_teacher_id);

-- Lab names unique within a school (case-insensitive, whitespace-collapsed).
-- Two schools can both have a "Design Centre"; one school can't have two.
-- Matches the dedup pattern used on schools.normalized_name (mig 085).
CREATE UNIQUE INDEX idx_fabrication_labs_unique_name_per_school
  ON fabrication_labs(
    school_id,
    lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
  );

-- Updated-at trigger — uses the shared update_updated_at_column()
-- function defined in earlier migrations (used by machine_profiles
-- in mig 093 + fabrication_scan_jobs in mig 096).
CREATE TRIGGER trg_fabrication_labs_updated_at
  BEFORE UPDATE ON fabrication_labs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. machine_profiles.lab_id
-- ============================================================
-- Nullable initially for backfill safety. Backfill (next migration)
-- populates it. Tightening to NOT NULL is a follow-up migration
-- after Checkpoint 8.1 confirms no orphans remain. ON DELETE SET
-- NULL: if a lab is force-deleted (rare), machines fall back to
-- "unassigned" rather than disappearing.

ALTER TABLE machine_profiles
  ADD COLUMN lab_id UUID NULL REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX idx_machine_profiles_lab
  ON machine_profiles(lab_id);

-- ============================================================
-- 3. classes.default_lab_id
-- ============================================================
-- Per-class binding lab. Student upload flow reads this. The G4
-- design teacher's class defaults to PYP Lab; the G8 design
-- teacher's class defaults to MYP Lab — same school, different
-- routing. Null fallback (legacy classes pre-backfill) shows all
-- school-owned machines.

ALTER TABLE classes
  ADD COLUMN default_lab_id UUID NULL REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX idx_classes_default_lab
  ON classes(default_lab_id);

-- ============================================================
-- 4. teachers.default_lab_id
-- ============================================================
-- Per-teacher preference. Seeds the dropdown when the teacher
-- creates a new class. Per-class default_lab_id is the binding
-- ground truth (parent brief §1 ship #3 + #4 — class default
-- wins, teacher default is just the suggestion).

ALTER TABLE teachers
  ADD COLUMN default_lab_id UUID NULL REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX idx_teachers_default_lab
  ON teachers(default_lab_id);

-- ============================================================
-- 5. SECURITY DEFINER helper for school-scoped RLS
-- ============================================================
-- Returns the calling teacher's school_id, NULL if not a teacher.
-- SECURITY DEFINER so the function reads teachers.school_id without
-- invoking RLS on teachers itself (which would otherwise recurse).
-- Read-only by design (no INSERT/UPDATE/DELETE inside).
--
-- STABLE: same input → same output within a transaction. PostgreSQL
-- can cache + plan around this; we get RLS without a per-row
-- subquery cost.

CREATE OR REPLACE FUNCTION current_teacher_school_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT school_id FROM teachers WHERE id = auth.uid()
$$;

-- Grant to authenticated role so RLS policies can call it.
-- Service role bypasses RLS entirely + can also call directly.
GRANT EXECUTE ON FUNCTION current_teacher_school_id() TO authenticated;

-- ============================================================
-- 6. Row-level security — school-scoped
-- ============================================================
-- A teacher sees + manages a lab if-and-only-if the lab's
-- school_id matches the teacher's school_id (returned by the
-- SECURITY DEFINER helper above).
--
-- Service role bypasses RLS implicitly — that's how student/fab
-- routes read labs transitively via machine_profiles joins. No
-- explicit service-role policy needed (matches machine_profiles
-- pattern from mig 093).

ALTER TABLE fabrication_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers read same-school labs"
  ON fabrication_labs FOR SELECT
  USING (school_id = current_teacher_school_id());

CREATE POLICY "Teachers insert labs into their school"
  ON fabrication_labs FOR INSERT
  WITH CHECK (school_id = current_teacher_school_id());

CREATE POLICY "Teachers update same-school labs"
  ON fabrication_labs FOR UPDATE
  USING (school_id = current_teacher_school_id())
  WITH CHECK (school_id = current_teacher_school_id());

CREATE POLICY "Teachers delete same-school labs"
  ON fabrication_labs FOR DELETE
  USING (school_id = current_teacher_school_id());

-- Lesson #51 compliance: no DO $$ DECLARE … END $$ verify blocks
-- here. Verification of state happens via post-apply SELECTs from
-- the orchestration tests + the backfill migration's verification
-- block (which uses RAISE NOTICE only, no table-name-like vars).
