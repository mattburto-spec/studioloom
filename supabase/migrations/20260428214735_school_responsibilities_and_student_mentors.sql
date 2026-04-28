-- Migration: school_responsibilities_and_student_mentors
-- Created: 20260428214735 UTC
-- Phase: Access Model v2 Phase 0.6c
--
-- WHY: Two related seams resolving the architectural conversation
--   surfaced 28 April after Matt's IB-coordinator question + the
--   dashboard-v2-build session's cross-program-mentorship findings —
--
--   1. school_responsibilities (programme coordinators):
--      A flat teachers.school_id model can't capture the IB pattern of
--      a teacher having cross-class admin responsibility for a
--      programme stream (PP / PYP / CAS / MYP / DP / Service). They're
--      not in authority over other teachers — they coordinate, sign
--      off, submit to IB. Without a seam, every programme feature
--      reinvents its own coordinator concept.
--
--   2. student_mentors (cross-program mentorship):
--      Resolves FU-MENTOR-SCOPE P1. The MYP teacher mentoring a PP
--      student in another teacher's class case — today the row exists
--      in student_projects.mentor_teacher_id but no API/RLS reads it
--      for scope (mentor gets 403 on PP cohort endpoint). This table
--      is the consolidation target. Polymorphic mentor identity via
--      auth.users(id) FK works for teachers + community_members +
--      guardians once Phase 1 + community_member auth land.
--
-- IMPACT: 2 new tables. RLS: Phase-0 baseline scoped reads
--   (school-membership for school_responsibilities; mentor self-read
--   + same-school teacher read for student_mentors). INSERT/UPDATE/
--   DELETE deny-by-default until Phase 3 expands via can() helper.
-- ROLLBACK: paired .down.sql drops both tables.
--
-- The Phase 3 permission helper `can(actor, action, resource)` will
-- read these via three helper functions:
--   has_class_role(class_id, role?)             -- class_members (Phase 0.7)
--   has_student_mentorship(student_id, programme?) -- this table
--   has_school_responsibility(school_id, type?)  -- this table
-- Dashboard scope endpoint returns the union with role badges.

-- ============================================================
-- 1. school_responsibilities — programme coordinators
-- ============================================================
-- Multiple coordinators per programme allowed (e.g., one PP coord per
-- year group; co-coordinators on rotation). No UNIQUE constraint.
-- Adding a coordinator = low-stakes change (audit-logged, revertable
-- per §8.3). Removing = high-stakes (2-teacher confirm).

CREATE TABLE school_responsibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  responsibility_type TEXT NOT NULL
    CHECK (responsibility_type IN (
      'pp_coordinator',
      'pyp_coordinator',
      'cas_coordinator',
      'myp_coordinator',
      'dp_coordinator',
      'service_coordinator',
      'safeguarding_lead'
    )),
  scope_jsonb JSONB NOT NULL DEFAULT '{}',
  -- Examples: {"year_group": "G10"} or {"programme_year": "2026"}
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active-only filter index for "who's the X coordinator at school Y?"
CREATE INDEX IF NOT EXISTS idx_school_responsibilities_active_lookup
  ON school_responsibilities(school_id, responsibility_type)
  WHERE deleted_at IS NULL;

-- Reverse lookup: "what responsibilities does teacher T have?"
CREATE INDEX IF NOT EXISTS idx_school_responsibilities_teacher
  ON school_responsibilities(teacher_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 2. student_mentors — student-specific mentorship (polymorphic mentor)
-- ============================================================
-- mentor_user_id REFERENCES auth.users(id) so the same column accepts
-- teachers / community_members / guardians once they all share
-- auth.users identity (Phase 1 brings students; §8.7 + §8.6 item 2
-- bring community_members + guardians).

CREATE TABLE student_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mentor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  programme TEXT NOT NULL
    CHECK (programme IN (
      'pp',
      'pypx',
      'cas',
      'service',
      'myp_personal_project',
      'open'
    )),
  scope_jsonb JSONB NOT NULL DEFAULT '{}',
  -- Examples: {"milestones": ["m1","m3"]} or {"valid_until": "2026-12-15"}
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Who mentors this student in this programme?" — primary access
CREATE INDEX IF NOT EXISTS idx_student_mentors_student_programme
  ON student_mentors(student_id, programme)
  WHERE deleted_at IS NULL;

-- "What students am I mentoring?" — mentor's dashboard scope chip
CREATE INDEX IF NOT EXISTS idx_student_mentors_mentor
  ON student_mentors(mentor_user_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 3. RLS — Phase 0 baseline scoped reads
-- ============================================================
-- school_responsibilities:
--   - SELECT: teachers in the same school can read all (mirrors school
--     governance — every teacher knows who the PYP coord is)
-- student_mentors:
--   - SELECT: mentor self-read (mentor_user_id = auth.uid())
--   - SELECT: teachers in the same school as the student can read
--     (uses students.school_id from Phase 0.3)
-- INSERT/UPDATE/DELETE: deny-by-default — only service role and Phase 3+
-- can() helper write paths populate these tables.

ALTER TABLE school_responsibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_mentors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_responsibilities_school_read"
  ON school_responsibilities FOR SELECT
  USING (
    school_id IN (
      SELECT t.school_id FROM teachers t
      WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
    )
  );

-- Mentor self-read: mentor_user_id matches my auth.uid().
CREATE POLICY "student_mentors_mentor_self_read"
  ON student_mentors FOR SELECT
  USING (mentor_user_id = auth.uid());

-- Same-school teacher read: any teacher whose school_id matches the
-- student's school_id can read. Phase 0.3's students.school_id makes
-- this a single-column predicate.
CREATE POLICY "student_mentors_school_teacher_read"
  ON student_mentors FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN teachers t ON t.school_id = s.school_id
      WHERE t.id = auth.uid()
        AND t.school_id IS NOT NULL
        AND s.school_id IS NOT NULL
    )
  );

-- ============================================================
-- 4. Sanity check
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_responsibilities'
  ) THEN
    RAISE EXCEPTION 'Migration failed: school_responsibilities missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_mentors'
  ) THEN
    RAISE EXCEPTION 'Migration failed: student_mentors missing';
  END IF;
  RAISE NOTICE 'Migration school_responsibilities_and_student_mentors applied OK: 2 tables + 4 indexes + 3 RLS policies';
END $$;
