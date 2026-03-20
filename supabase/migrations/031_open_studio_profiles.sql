-- Open Studio Profiles — Discovery output for each student's Open Studio journey
-- Stores: strengths, interests, needs, project statement, archetype, discovery conversation

CREATE TABLE IF NOT EXISTS open_studio_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  -- Discovery outputs
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,       -- array of {area: string, description: string}
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,        -- array of {topic: string, category: string}
  needs_identified JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {need: string, context: string}
  project_statement TEXT,                               -- 1-paragraph project description
  archetype TEXT CHECK (archetype IS NULL OR archetype IN (
    'make', 'research', 'lead', 'serve', 'create', 'solve', 'entrepreneurship'
  )),

  -- Discovery conversation history
  discovery_conversation JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {role: 'ai'|'student', content: string, step: string, timestamp: string}
  discovery_step TEXT NOT NULL DEFAULT 'strengths'
    CHECK (discovery_step IN ('strengths', 'interests', 'needs', 'narrowing', 'commitment', 'complete')),

  -- Timestamps
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One profile per student per unit
  UNIQUE (student_id, unit_id)
);

-- Fast lookups
CREATE INDEX IF NOT EXISTS idx_os_profiles_student ON open_studio_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_os_profiles_unit ON open_studio_profiles(unit_id);
CREATE INDEX IF NOT EXISTS idx_os_profiles_discovery_step ON open_studio_profiles(discovery_step);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_os_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_os_profiles_updated_at
  BEFORE UPDATE ON open_studio_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_os_profiles_updated_at();

-- RLS
ALTER TABLE open_studio_profiles ENABLE ROW LEVEL SECURITY;

-- Permissive read for service-role access (all API routes use createAdminClient)
CREATE POLICY "Service role full access on open_studio_profiles"
  ON open_studio_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);
