-- Migration 111: PYPX Exhibition schema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 13a of the teacher-dashboard-v1 build (see
-- docs/projects/teacher-dashboard-v1-phase-13a-brief.md).
--
-- Adds:
--   1. `class_units.exhibition_config JSONB` — per class+unit config for
--      Exhibition date + flexible milestones array + mentor check-in cadence.
--      Mirrors the existing nm_config / schedule-overrides pattern on
--      class_units; no new table for dates (keeps FK surface flat).
--
--   2. `student_projects` table — one row per (student × class × unit)
--      holding the PYP Exhibition project record: title, central idea,
--      lines of inquiry, transdisciplinary theme, mentor_teacher_id,
--      current_phase (wonder | findout | make | share | reflect).
--
-- Not yet wired in the app (Phase 13a-2 adds API routes, 13a-3..6 add
-- the teacher setup UI). This migration is safe to apply in isolation —
-- no data backfill required; all new fields are nullable with sensible
-- defaults.
--
-- Depends on: 001 (classes, units), 001 (students, teachers), 040
-- (class_units composite PK + forked_at / nm_config JSONB alongside).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. class_units — add exhibition_config JSONB
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS exhibition_config JSONB NULL;

COMMENT ON COLUMN class_units.exhibition_config IS
  'PYP Exhibition config (Phase 13a). Shape:
   { exhibition_date: "YYYY-MM-DD"?,
     mentor_checkin_interval_days: number?,
     milestones: [{ id: string, label: string, date: "YYYY-MM-DD", type: string }]?
   }
   NULL when the class_unit is not running an Exhibition. All fields
   within the object are optional; a teacher can set just the exhibition
   date, then add milestones incrementally.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. student_projects — per-student Exhibition project record
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS student_projects (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: one project per student within a specific class's unit.
  -- Students can have multiple projects across different classes/units
  -- but only one within any given (class, unit) combination.
  student_id              UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id                UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  unit_id                 UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,

  -- Project content — teacher-scaffoldable, student-primary post-13c.
  title                   TEXT NULL,
  central_idea            TEXT NULL,
  lines_of_inquiry        TEXT[] NULL,                  -- unbounded array
  transdisciplinary_theme TEXT NULL,                    -- free text for v1;
                                                        -- PYP's 6 themes enum in a later cleanup

  -- Mentor assignment — teacher-only. Another teacher in the same
  -- school mentors this student's inquiry. Nullable for students
  -- awaiting mentor assignment.
  mentor_teacher_id       UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,

  -- Phase — jointly owned (student self-reports, teacher overrides).
  current_phase           TEXT NULL CHECK (
    current_phase IS NULL OR
    current_phase IN ('wonder', 'findout', 'make', 'share', 'reflect')
  ),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (student_id, class_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_student_projects_class_unit
  ON student_projects (class_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_student_projects_student
  ON student_projects (student_id);

CREATE INDEX IF NOT EXISTS idx_student_projects_mentor
  ON student_projects (mentor_teacher_id)
  WHERE mentor_teacher_id IS NOT NULL;

-- Shared timestamp trigger (function created by 026_student_tool_sessions.sql,
-- re-CREATED with OR REPLACE so this migration is idempotent standalone).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_projects_set_updated_at ON student_projects;
CREATE TRIGGER student_projects_set_updated_at
  BEFORE UPDATE ON student_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Row Level Security — student_projects
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE student_projects ENABLE ROW LEVEL SECURITY;

-- Teachers: full CRUD on projects in classes they own, OR projects
-- where they're the assigned mentor (cross-class mentoring pattern —
-- a specialist teacher mentors students they don't teach directly).
DROP POLICY IF EXISTS "Teachers manage student_projects" ON student_projects;
CREATE POLICY "Teachers manage student_projects"
  ON student_projects FOR ALL
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
    OR mentor_teacher_id = auth.uid()
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
    OR mentor_teacher_id = auth.uid()
  );

-- Students: read-only on their own project row. Matches the dual-auth
-- pattern used by 041 (class_students) — a valid unexpired
-- student_session proves the student identity.
DROP POLICY IF EXISTS "Students read own student_projects" ON student_projects;
CREATE POLICY "Students read own student_projects"
  ON student_projects FOR SELECT
  USING (
    student_id IN (
      SELECT ss.student_id FROM student_sessions ss
      WHERE ss.expires_at > NOW()
    )
  );

-- Service role bypass (admin operations, background jobs, future
-- analytics pipelines).
DROP POLICY IF EXISTS "Service role manages student_projects" ON student_projects;
CREATE POLICY "Service role manages student_projects"
  ON student_projects FOR ALL
  USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Table + column comments (documentation for schema browsers)
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE student_projects IS
  'PYP Exhibition project per (student × class × unit). Teacher scaffolds
   content early, student takes ownership from Phase 13c onwards. Teacher
   always retains override access. Mentor is a teacher assignment (may be
   different from the class teacher) — mentored cross-class access is
   supported via the RLS mentor_teacher_id clause.';

COMMENT ON COLUMN student_projects.current_phase IS
  'PYP inquiry phase: wonder → findout → make → share → reflect. NULL
   while the student hasn''t started. Student self-reports from their
   dashboard; teacher can override from /teacher/classes/.../exhibition.';

COMMENT ON COLUMN student_projects.mentor_teacher_id IS
  'Assigned mentor teacher (FK teachers.id). NULL until the class teacher
   assigns one. Mentors get RLS access to this row even if they do not
   own the class (cross-class mentoring supported).';
