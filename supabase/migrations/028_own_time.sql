-- Own Time: Self-directed learning with AI mentoring
-- Students earn autonomous time by demonstrating mastery of required work.
-- Teachers explicitly approve students for Own Time.

-- ─────────────────────────────────────────────────
-- 1. Own Time approval status per student per class
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS own_time_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,  -- which unit they earned it from
  teacher_note TEXT,                                      -- personal message shown to student
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,                                -- NULL = active, set = revoked

  UNIQUE (student_id, class_id)                          -- one approval per student per class
);

-- Index for student lookups (dashboard card)
CREATE INDEX IF NOT EXISTS idx_own_time_student ON own_time_approvals(student_id) WHERE revoked_at IS NULL;

-- Index for teacher lookups (class dashboard)
CREATE INDEX IF NOT EXISTS idx_own_time_class ON own_time_approvals(class_id) WHERE revoked_at IS NULL;


-- ─────────────────────────────────────────────────
-- 2. Own Time projects (learning plans)
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS own_time_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  approval_id UUID NOT NULL REFERENCES own_time_approvals(id) ON DELETE CASCADE,
  learning_plan JSONB NOT NULL DEFAULT '{}',  -- project, deliverables, skill, timeline, success
  status TEXT NOT NULL DEFAULT 'planning',     -- planning, active, completed, paused
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_own_time_projects_student ON own_time_projects(student_id);


-- ─────────────────────────────────────────────────
-- 3. Own Time sessions (per working session)
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS own_time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES own_time_projects(id) ON DELETE CASCADE,
  session_number SMALLINT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  conversation JSONB NOT NULL DEFAULT '[]',      -- {role, content}[] message history
  reflection TEXT,                                -- student's end-of-session reflection
  ai_summary TEXT,                                -- AI-generated session digest
  engagement_score SMALLINT CHECK (engagement_score BETWEEN 1 AND 5),
  focus_area TEXT                                 -- what they worked on this session
);

CREATE INDEX IF NOT EXISTS idx_own_time_sessions_project ON own_time_sessions(project_id);


-- ─────────────────────────────────────────────────
-- 4. RLS Policies
-- ─────────────────────────────────────────────────

ALTER TABLE own_time_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE own_time_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE own_time_sessions ENABLE ROW LEVEL SECURITY;

-- Teachers can manage approvals for their own classes
CREATE POLICY own_time_approvals_teacher ON own_time_approvals
  FOR ALL USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
  );

-- Students can read their own approvals (via API with token auth, not RLS)
-- We add a permissive select for service role usage
CREATE POLICY own_time_approvals_read ON own_time_approvals
  FOR SELECT USING (true);

-- Projects: teachers see all in their classes, service role handles student access
CREATE POLICY own_time_projects_teacher ON own_time_projects
  FOR ALL USING (
    approval_id IN (
      SELECT id FROM own_time_approvals
      WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    )
  );

CREATE POLICY own_time_projects_read ON own_time_projects
  FOR SELECT USING (true);

-- Sessions follow projects
CREATE POLICY own_time_sessions_teacher ON own_time_sessions
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM own_time_projects p
      JOIN own_time_approvals a ON a.id = p.approval_id
      WHERE a.class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    )
  );

CREATE POLICY own_time_sessions_read ON own_time_sessions
  FOR SELECT USING (true);


-- ─────────────────────────────────────────────────
-- 5. Updated_at trigger for projects
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_own_time_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER own_time_project_updated_at
  BEFORE UPDATE ON own_time_projects
  FOR EACH ROW EXECUTE FUNCTION update_own_time_project_updated_at();
