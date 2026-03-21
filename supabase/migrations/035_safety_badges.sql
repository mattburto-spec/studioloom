-- Migration 035: Safety Badges System
-- Complete gamified safety certification system with test pools, learning content,
-- and auto-awarded badges. Supports built-in (system) + teacher-created badges.
-- Two entry points: embedded in StudioLoom units, and standalone free tool for
-- teachers without a StudioLoom account (via class code).

-- ═══════════════════════════════════════════════════════════════
-- 1. BADGES — Badge definitions (built-in + teacher-created)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  -- Slug used in URLs: 'general-workshop-safety', 'laser-cutter-advanced'
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Category for grouping and filtering
  category TEXT NOT NULL DEFAULT 'safety'
    CHECK (category IN ('safety', 'skill', 'software')),

  -- Progression tier (progression path: foundation → area → machine → specialist)
  tier INTEGER NOT NULL DEFAULT 1
    CHECK (tier >= 1 AND tier <= 4),

  -- Icon identifier for client-side SVG (e.g., 'shield', 'laser-cutter', 'fire')
  icon_name TEXT NOT NULL DEFAULT 'shield',

  -- Badge accent color (hex or CSS color name)
  color TEXT NOT NULL DEFAULT '#7C3AED',

  -- Is this a built-in system badge or teacher-created?
  is_built_in BOOLEAN NOT NULL DEFAULT false,

  -- Teacher who created this badge (null for built-in)
  created_by_teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Scoring and expiry
  pass_threshold INTEGER NOT NULL DEFAULT 80
    CHECK (pass_threshold >= 0 AND pass_threshold <= 100),
  expiry_months INTEGER, -- null = never expires

  -- How long before a student can retake the test (minutes)
  retake_cooldown_minutes INTEGER NOT NULL DEFAULT 10
    CHECK (retake_cooldown_minutes >= 0),

  -- How many questions to draw from question_pool per test attempt
  question_count INTEGER NOT NULL DEFAULT 10
    CHECK (question_count >= 1),

  -- Array of question objects: {id, text, type, options?, correct_answer}
  question_pool JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Array of illustrated learning cards shown before test:
  -- {id, title, description, icon, tips[], examples[]}
  learn_content JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Topic tags for analytics and filtering
  topics TEXT[] NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_badges_slug ON badges(slug);
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);
CREATE INDEX IF NOT EXISTS idx_badges_created_by ON badges(created_by_teacher_id);
CREATE INDEX IF NOT EXISTS idx_badges_is_built_in ON badges(is_built_in);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_badges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_badges_updated_at ON badges;
CREATE TRIGGER trigger_badges_updated_at
  BEFORE UPDATE ON badges
  FOR EACH ROW
  EXECUTE FUNCTION update_badges_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 2. STUDENT_BADGES — Awarded badges with scores and metadata
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS student_badges (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL, -- nanoid from student_sessions
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,

  -- Score (0-100, null for skill badges that don't have scores)
  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),

  -- Which attempt this is (students can retake)
  attempt_number INTEGER NOT NULL DEFAULT 1
    CHECK (attempt_number >= 1),

  -- How the badge was granted: 'test' (earned), teacher_id (manually granted)
  granted_by TEXT NOT NULL DEFAULT 'test',

  -- Teacher's optional note when granting manually
  teacher_note TEXT,

  -- Current status: active, expired, revoked
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked')),

  -- Student's answers to the test questions (for review/debugging)
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- How long the test took (seconds)
  time_taken_seconds INTEGER CHECK (time_taken_seconds IS NULL OR time_taken_seconds >= 0),

  -- When this badge was awarded
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- When this badge expires (computed from badge.expiry_months)
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate active awards (student can only have one active per badge per attempt)
  UNIQUE(student_id, badge_id, attempt_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_student_badges_student ON student_badges(student_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_badge ON student_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_status ON student_badges(status);
CREATE INDEX IF NOT EXISTS idx_student_badges_awarded_at ON student_badges(awarded_at);

-- ═══════════════════════════════════════════════════════════════
-- 3. UNIT_BADGE_REQUIREMENTS — Which badges a unit requires
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS unit_badge_requirements (
  id TEXT PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,

  -- Is this badge mandatory before starting the unit?
  is_required BOOLEAN NOT NULL DEFAULT true,

  -- Position in the required badges list (for UI ordering)
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One unit can have multiple badge requirements, but not duplicates
  UNIQUE(unit_id, badge_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unit_badge_reqs_unit ON unit_badge_requirements(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_badge_reqs_badge ON unit_badge_requirements(badge_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. SAFETY_SESSIONS — Teacher-created sessions for free tool
-- ═══════════════════════════════════════════════════════════════
-- These allow teachers without StudioLoom accounts to create a class code
-- and have students take safety tests. No auth required — just email + code.

CREATE TABLE IF NOT EXISTS safety_sessions (
  id TEXT PRIMARY KEY,

  -- Teacher contact (no auth required for free tool)
  teacher_email TEXT NOT NULL,
  teacher_name TEXT,

  -- Class identifier that students use to join
  class_code TEXT UNIQUE NOT NULL, -- 6-char alphanumeric, e.g. 'AB12CD'

  -- Class context
  class_name TEXT,

  -- Array of badge IDs required for this class
  required_badges TEXT[] NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sessions expire after 90 days of inactivity
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_safety_sessions_class_code ON safety_sessions(class_code);
CREATE INDEX IF NOT EXISTS idx_safety_sessions_teacher_email ON safety_sessions(teacher_email);
CREATE INDEX IF NOT EXISTS idx_safety_sessions_expires_at ON safety_sessions(expires_at);

-- ═══════════════════════════════════════════════════════════════
-- 5. SAFETY_RESULTS — Test results from the free tool
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS safety_results (
  id TEXT PRIMARY KEY,

  -- Link to the session (student joined via class code)
  session_id TEXT NOT NULL REFERENCES safety_sessions(id) ON DELETE CASCADE,

  -- Student identifier (no auth — just a name)
  student_name TEXT NOT NULL,

  -- Which badge they were tested on
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,

  -- Result
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN NOT NULL,

  -- Student's answers to questions
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- How long the test took (seconds)
  time_taken_seconds INTEGER CHECK (time_taken_seconds >= 0),

  -- Attempt number if they retake
  attempt_number INTEGER NOT NULL DEFAULT 1
    CHECK (attempt_number >= 1),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_safety_results_session ON safety_results(session_id);
CREATE INDEX IF NOT EXISTS idx_safety_results_badge ON safety_results(badge_id);
CREATE INDEX IF NOT EXISTS idx_safety_results_student_name ON safety_results(student_name);
CREATE INDEX IF NOT EXISTS idx_safety_results_created_at ON safety_results(created_at);

-- ═══════════════════════════════════════════════════════════════
-- 6. RLS POLICIES
-- ═══════════════════════════════════════════════════════════════

-- Badges: everyone can read (public discovery)
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY badges_readable ON badges
  FOR SELECT USING (true);

-- Teachers can insert and update their own badges
CREATE POLICY badges_teacher_insert ON badges
  FOR INSERT WITH CHECK (created_by_teacher_id = auth.uid() OR is_built_in);

CREATE POLICY badges_teacher_update ON badges
  FOR UPDATE USING (created_by_teacher_id = auth.uid())
  WITH CHECK (created_by_teacher_id = auth.uid());

-- Student badges: students can read their own
ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_badges_read_own ON student_badges
  FOR SELECT USING (
    student_id = current_setting('app.student_id', true)
    OR student_id = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Teachers can read badges awarded to their class members
CREATE POLICY student_badges_teacher_read ON student_badges
  FOR SELECT USING (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    )
  );

-- Teachers can insert student badges for their classes
CREATE POLICY student_badges_teacher_insert ON student_badges
  FOR INSERT WITH CHECK (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    )
  );

-- Unit badge requirements: teachers can manage for their own units
ALTER TABLE unit_badge_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY unit_badge_reqs_read ON unit_badge_requirements
  FOR SELECT USING (true); -- Public read for UI to show required badges

CREATE POLICY unit_badge_reqs_teacher ON unit_badge_requirements
  FOR ALL USING (
    unit_id IN (SELECT id FROM units WHERE author_teacher_id = auth.uid())
  );

-- Safety sessions: creator can manage, others can join via code
ALTER TABLE safety_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY safety_sessions_creator ON safety_sessions
  FOR ALL USING (teacher_email = COALESCE(auth.email(), ''));

-- Anyone can read sessions by code (to join)
CREATE POLICY safety_sessions_read_by_code ON safety_sessions
  FOR SELECT USING (true);

-- Safety results: public write (students submit via code), creator can read
ALTER TABLE safety_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY safety_results_read ON safety_results
  FOR SELECT USING (
    session_id IN (SELECT id FROM safety_sessions WHERE teacher_email = COALESCE(auth.email(), ''))
  );

-- Public insert (students submit results via code)
CREATE POLICY safety_results_insert ON safety_results
  FOR INSERT WITH CHECK (true);
