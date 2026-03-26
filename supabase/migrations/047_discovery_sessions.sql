-- Discovery Engine — Session Persistence
-- Stores student discovery sessions with full profile JSONB.
-- One active session per student per unit.

CREATE TABLE IF NOT EXISTS discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  class_id TEXT,
  state TEXT NOT NULL DEFAULT 'station_0',
  profile JSONB NOT NULL DEFAULT '{}',
  mode TEXT NOT NULL DEFAULT 'mode_1',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_student_unit
  ON discovery_sessions (student_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_class
  ON discovery_sessions (class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_state
  ON discovery_sessions (state) WHERE state != 'completed';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_discovery_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER discovery_sessions_updated_at
  BEFORE UPDATE ON discovery_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_discovery_sessions_updated_at();

-- RLS policies
ALTER TABLE discovery_sessions ENABLE ROW LEVEL SECURITY;

-- Students can read their own sessions
CREATE POLICY discovery_sessions_student_select
  ON discovery_sessions FOR SELECT
  USING (student_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Service role can do everything (used by admin client)
CREATE POLICY discovery_sessions_service_all
  ON discovery_sessions FOR ALL
  USING (true)
  WITH CHECK (true);
