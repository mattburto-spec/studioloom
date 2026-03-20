-- Migration 026: Student Toolkit Tool Sessions
-- Adds support for persisting student work in interactive toolkit tools (SCAMPER, Six Hats, PMI, etc.)
--
-- Tables:
--   - student_tool_sessions: stores one session per student+tool attempt
--   - versioning: multiple attempts per student per unit page per tool via version INT
--   - portfolio_integration: completed sessions auto-capture to portfolio_entries

BEGIN;

-- Create student_tool_sessions table
CREATE TABLE IF NOT EXISTS student_tool_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,                          -- e.g., "scamper", "decision-matrix"
  challenge TEXT NOT NULL,                        -- the problem/topic the student entered
  mode TEXT NOT NULL DEFAULT 'standalone'         CHECK (mode IN ('embedded', 'standalone')),

  -- For embedded mode: links to the unit page
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  page_id TEXT,                                   -- the page within the unit
  section_index INT,                              -- which activity section on the page

  -- Tool state (the actual work)
  state JSONB NOT NULL DEFAULT '{}',              -- full tool state: steps, ideas, scores, etc.
  summary JSONB,                                  -- AI-generated summary from the tool's summary screen

  -- Versioning (multiple attempts per tool per page)
  version INT NOT NULL DEFAULT 1,

  -- Metadata
  status TEXT NOT NULL DEFAULT 'in_progress'      CHECK (status IN ('in_progress', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Portfolio integration
  portfolio_entry_id UUID REFERENCES portfolio_entries(id) ON DELETE SET NULL,

  -- Ensure version uniqueness per student+tool+page for embedded, but allow multiple standalone
  CONSTRAINT unique_embedded_version UNIQUE (student_id, unit_id, page_id, tool_id, version)
    DEFERRABLE INITIALLY DEFERRED,

  -- Validate embedded mode has unit_id and page_id
  CONSTRAINT embedded_mode_requires_location CHECK (
    mode = 'standalone' OR (unit_id IS NOT NULL AND page_id IS NOT NULL)
  )
);

-- Indexes for fast lookups
CREATE INDEX idx_tool_sessions_student ON student_tool_sessions(student_id);
CREATE INDEX idx_tool_sessions_unit ON student_tool_sessions(unit_id, page_id) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_tool_sessions_tool ON student_tool_sessions(tool_id);
CREATE INDEX idx_tool_sessions_status ON student_tool_sessions(status);
CREATE INDEX idx_tool_sessions_student_tool ON student_tool_sessions(student_id, tool_id);
CREATE INDEX idx_tool_sessions_unit_page_tool ON student_tool_sessions(unit_id, page_id, tool_id)
  WHERE unit_id IS NOT NULL;

-- RLS: Enable but allow service role full access
-- API routes authenticate students server-side, then use service role key
-- Proper per-student RLS policies to be added when moving to production (see design-guidelines.md F5)
ALTER TABLE student_tool_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON student_tool_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create the updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at on every change
CREATE TRIGGER update_student_tool_sessions_updated_at
  BEFORE UPDATE ON student_tool_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
