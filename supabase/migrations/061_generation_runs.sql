-- Migration 061: Generation Runs logging table
-- Part of Dimensions3 Phase A — tracks every pipeline execution for cost,
-- debugging, and quality analysis.

CREATE TABLE IF NOT EXISTS generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id),

  -- Request context
  request JSONB NOT NULL,               -- Full GenerationRequest snapshot
  format_id TEXT NOT NULL,              -- FormatProfile used
  framework TEXT NOT NULL,              -- Framework ID

  -- Pipeline progress
  status TEXT NOT NULL DEFAULT 'pending', -- pending/running/completed/failed/cancelled
  current_stage INT DEFAULT 0,          -- 0-6

  -- Per-stage results (populated as stages complete)
  stage_results JSONB DEFAULT '{}',     -- { "0": { output: ..., cost: ..., timeMs: ... }, ... }

  -- Final output
  output_unit_id UUID,                  -- If pipeline completed: the created unit ID
  quality_report JSONB,                 -- Stage 6 QualityReport

  -- Aggregate cost
  total_cost JSONB,                     -- CostBreakdown aggregate
  total_time_ms INT,

  -- Error tracking
  error_message TEXT,
  error_stage INT,                      -- Which stage failed

  -- Metadata
  model_config JSONB,                   -- AI model settings snapshot at generation time
  sandbox_mode BOOLEAN DEFAULT false,   -- True if run from admin sandbox
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gen_runs_teacher ON generation_runs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_gen_runs_status ON generation_runs(status);
CREATE INDEX IF NOT EXISTS idx_gen_runs_created ON generation_runs(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_generation_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generation_runs_updated_at ON generation_runs;
CREATE TRIGGER trigger_generation_runs_updated_at
  BEFORE UPDATE ON generation_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_generation_runs_updated_at();

-- RLS
ALTER TABLE generation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY gen_runs_select ON generation_runs
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY gen_runs_insert ON generation_runs
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY gen_runs_update ON generation_runs
  FOR UPDATE USING (teacher_id = auth.uid());
