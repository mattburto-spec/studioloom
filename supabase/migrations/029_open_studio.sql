-- Open Studio: Self-directed learning mode that replaces Own Time.
-- Students earn Open Studio by teacher approval (MVP).
-- AI shifts from Socratic tutor to studio critic.
-- Replaces: own_time_approvals, own_time_projects, own_time_sessions (migration 028)

-- ─────────────────────────────────────────────────
-- 0. Drop Own Time tables (028 was never applied to prod)
-- ─────────────────────────────────────────────────

DROP TABLE IF EXISTS own_time_sessions CASCADE;
DROP TABLE IF EXISTS own_time_projects CASCADE;
DROP TABLE IF EXISTS own_time_approvals CASCADE;
DROP FUNCTION IF EXISTS update_own_time_project_updated_at();

-- ─────────────────────────────────────────────────
-- 1. Open Studio status — per-student per-unit
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS open_studio_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'locked'
    CHECK (status IN ('locked', 'unlocked', 'revoked')),
  unlocked_by TEXT NOT NULL DEFAULT 'teacher'
    CHECK (unlocked_by IN ('teacher', 'auto', 'criteria')),
  teacher_note TEXT,                    -- Message shown to student on unlock

  -- Configuration (teacher-configurable per student)
  check_in_interval_min SMALLINT NOT NULL DEFAULT 15
    CHECK (check_in_interval_min BETWEEN 5 AND 30),
  carry_forward BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  unlocked_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
    CHECK (revoked_reason IS NULL OR revoked_reason IN (
      'teacher_manual', 'drift_detected', 'recalibrate'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One record per student per unit
  UNIQUE (student_id, unit_id)
);

-- Fast lookups for student dashboard (active Open Studio)
CREATE INDEX IF NOT EXISTS idx_open_studio_student_active
  ON open_studio_status(student_id)
  WHERE status = 'unlocked';

-- Fast lookups for teacher dashboard (class + unit)
CREATE INDEX IF NOT EXISTS idx_open_studio_class_unit
  ON open_studio_status(class_id, unit_id);

-- ─────────────────────────────────────────────────
-- 2. Open Studio sessions — per working session
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS open_studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  status_id UUID NOT NULL REFERENCES open_studio_status(id) ON DELETE CASCADE,

  session_number SMALLINT NOT NULL DEFAULT 1,

  -- What the student chose to work on
  focus_area TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  -- Activity tracking
  activity_log JSONB NOT NULL DEFAULT '[]',
  -- [{type: "save"|"tool_use"|"response"|"reflection", description: string, timestamp: string}]

  ai_interactions SMALLINT NOT NULL DEFAULT 0,     -- student-initiated AI chats
  check_in_count SMALLINT NOT NULL DEFAULT 0,      -- periodic check-ins fired

  -- Drift detection
  drift_flags JSONB NOT NULL DEFAULT '[]',
  -- [{level: "gentle"|"direct"|"silent", message: string, timestamp: string}]

  -- AI assessment (set at session end)
  productivity_score TEXT
    CHECK (productivity_score IS NULL OR productivity_score IN ('low', 'medium', 'high')),
  ai_summary TEXT,                                 -- auto-generated session digest for teacher

  -- Student reflection (end of session)
  reflection TEXT
);

-- Session lookups by student + unit
CREATE INDEX IF NOT EXISTS idx_open_studio_sessions_student_unit
  ON open_studio_sessions(student_id, unit_id);

-- Session lookups by status (for teacher dashboard aggregation)
CREATE INDEX IF NOT EXISTS idx_open_studio_sessions_status
  ON open_studio_sessions(status_id);

-- ─────────────────────────────────────────────────
-- 3. RLS Policies
-- ─────────────────────────────────────────────────

ALTER TABLE open_studio_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_studio_sessions ENABLE ROW LEVEL SECURITY;

-- Teachers can manage Open Studio for their own classes
CREATE POLICY open_studio_status_teacher ON open_studio_status
  FOR ALL USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
  );

-- Permissive read for service-role access (student API uses admin client + token auth)
CREATE POLICY open_studio_status_read ON open_studio_status
  FOR SELECT USING (true);

-- Teachers see sessions for their classes
CREATE POLICY open_studio_sessions_teacher ON open_studio_sessions
  FOR ALL USING (
    status_id IN (
      SELECT s.id FROM open_studio_status s
      WHERE s.class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    )
  );

-- Permissive read for service-role access
CREATE POLICY open_studio_sessions_read ON open_studio_sessions
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────────
-- 4. Updated_at trigger
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_open_studio_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER open_studio_status_updated_at
  BEFORE UPDATE ON open_studio_status
  FOR EACH ROW EXECUTE FUNCTION update_open_studio_status_updated_at();
