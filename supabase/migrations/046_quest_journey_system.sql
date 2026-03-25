-- ================================================
-- Migration 046: Quest Journey System
-- Student quest/journey system for Open Studio, Service, PP, PYPx
-- ================================================

-- ─────────────────────────────────────────────────
-- quest_journeys — one per student per unit
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quest_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,

  -- Framework & mentor
  framework_id TEXT NOT NULL DEFAULT 'myp_design',
  mentor_id TEXT,  -- 'kit' | 'sage' | 'river' | 'spark' | 'haven' | NULL

  -- Quest phase state machine
  phase TEXT NOT NULL DEFAULT 'not_started',
  -- Valid: 'not_started' | 'discovery' | 'planning' | 'working' | 'sharing' | 'completed'
  phase_entered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Discovery output
  discovery_profile JSONB DEFAULT NULL,

  -- Student contract
  contract JSONB DEFAULT NULL,

  -- Teacher controls
  help_intensity TEXT NOT NULL DEFAULT 'guided',
  -- Valid: 'explorer' | 'guided' | 'supported' | 'auto'

  -- Health score (computed, cached)
  health_score JSONB DEFAULT '{"momentum":"green","engagement":"green","quality":"green","self_awareness":"green","last_computed_at":null,"check_in_interval_minutes":15}',

  -- Session stats (denormalized for dashboard)
  total_sessions INTEGER DEFAULT 0,
  total_evidence_count INTEGER DEFAULT 0,
  sessions_remaining INTEGER,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(student_id, unit_id)
);

-- ─────────────────────────────────────────────────
-- quest_milestones — ordered checkpoints within a journey
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quest_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES quest_journeys(id) ON DELETE CASCADE,

  -- Milestone definition
  title TEXT NOT NULL,
  description TEXT,
  phase TEXT NOT NULL,
  framework_phase_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- SMART goal fields
  specific TEXT,
  measurable TEXT,
  target_date DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'upcoming',
  -- Valid: 'upcoming' | 'active' | 'completed' | 'skipped' | 'overdue'
  completed_at TIMESTAMPTZ,
  completion_note TEXT,

  -- Teacher adjustments
  teacher_note TEXT,
  teacher_adjusted_date DATE,

  -- Approval (teacher must approve evidence before milestone counts)
  approved_by_teacher BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,

  -- Source
  source TEXT NOT NULL DEFAULT 'student',
  -- Valid: 'student' | 'ai_suggested' | 'template' | 'teacher'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- quest_evidence — multi-channel evidence collection
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quest_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES quest_journeys(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES quest_milestones(id) ON DELETE SET NULL,

  -- Evidence type
  type TEXT NOT NULL,
  -- Valid: 'photo' | 'voice' | 'text' | 'file' | 'link' | 'reflection' | 'tool_session' | 'ai_conversation'

  -- Content
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  thumbnail_url TEXT,

  -- AI analysis (populated async)
  ai_analysis JSONB DEFAULT NULL,

  -- Approval
  approved_by_teacher BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  teacher_feedback TEXT,

  -- Context
  phase TEXT NOT NULL,
  framework_phase_id TEXT,
  session_id UUID,  -- references open_studio_sessions if applicable

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- quest_mentor_interactions — log of AI mentor exchanges
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quest_mentor_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES quest_journeys(id) ON DELETE CASCADE,

  interaction_type TEXT NOT NULL,
  -- Valid: 'discovery_step' | 'check_in' | 'help_request' | 'drift_check' |
  --        'documentation_nudge' | 'alignment_check' | 'milestone_review' |
  --        'celebration' | 'contract_coaching' | 'planning_help'
  phase TEXT NOT NULL,
  mentor_id TEXT NOT NULL,

  student_message TEXT,
  mentor_response TEXT,
  structured_data JSONB DEFAULT NULL,

  student_effort_level TEXT,  -- 'low' | 'medium' | 'high'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- Modifications to existing tables
-- ─────────────────────────────────────────────────
ALTER TABLE open_studio_status
  ADD COLUMN IF NOT EXISTS quest_journey_id UUID REFERENCES quest_journeys(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quest_journeys_student ON quest_journeys(student_id);
CREATE INDEX IF NOT EXISTS idx_quest_journeys_unit ON quest_journeys(unit_id);
CREATE INDEX IF NOT EXISTS idx_quest_journeys_class ON quest_journeys(class_id);
CREATE INDEX IF NOT EXISTS idx_quest_journeys_phase ON quest_journeys(phase);
CREATE INDEX IF NOT EXISTS idx_quest_milestones_journey ON quest_milestones(journey_id);
CREATE INDEX IF NOT EXISTS idx_quest_milestones_status ON quest_milestones(status);
CREATE INDEX IF NOT EXISTS idx_quest_evidence_journey ON quest_evidence(journey_id);
CREATE INDEX IF NOT EXISTS idx_quest_evidence_milestone ON quest_evidence(milestone_id);
CREATE INDEX IF NOT EXISTS idx_quest_evidence_type ON quest_evidence(type);
CREATE INDEX IF NOT EXISTS idx_quest_mentor_journey ON quest_mentor_interactions(journey_id);

-- ─────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────
ALTER TABLE quest_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_mentor_interactions ENABLE ROW LEVEL SECURITY;

-- Student policies (via JWT sub claim)
CREATE POLICY quest_journeys_student_select ON quest_journeys
  FOR SELECT USING (student_id::text = current_setting('request.jwt.claims', true)::json->>'sub');
CREATE POLICY quest_journeys_student_update ON quest_journeys
  FOR UPDATE USING (student_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY quest_milestones_student ON quest_milestones
  FOR ALL USING (
    journey_id IN (SELECT id FROM quest_journeys WHERE student_id::text = current_setting('request.jwt.claims', true)::json->>'sub')
  );

CREATE POLICY quest_evidence_student ON quest_evidence
  FOR ALL USING (
    journey_id IN (SELECT id FROM quest_journeys WHERE student_id::text = current_setting('request.jwt.claims', true)::json->>'sub')
  );

CREATE POLICY quest_mentor_interactions_student ON quest_mentor_interactions
  FOR SELECT USING (
    journey_id IN (SELECT id FROM quest_journeys WHERE student_id::text = current_setting('request.jwt.claims', true)::json->>'sub')
  );

-- ─────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────
CREATE TRIGGER quest_journeys_updated_at
  BEFORE UPDATE ON quest_journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER quest_milestones_updated_at
  BEFORE UPDATE ON quest_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
