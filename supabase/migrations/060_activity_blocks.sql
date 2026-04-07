-- Migration 060: Activity Blocks table
-- Part of Dimensions3 Phase A — the block library that replaces per-generation-call activities.
-- Blocks are format-neutral by design: phase uses FormatProfile phase IDs,
-- activity_category uses the 14-category taxonomy, framework applied at render time.

CREATE TABLE IF NOT EXISTS activity_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id),

  -- Identity
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,                 -- Student-facing instruction

  -- Source tracking
  source_type TEXT NOT NULL,            -- 'extracted' | 'generated' | 'manual' | 'community'
  source_upload_id UUID,
  source_unit_id UUID,
  source_page_id TEXT,
  source_activity_index INT,

  -- Dimensions metadata
  bloom_level TEXT,                     -- remember/understand/apply/analyze/evaluate/create
  time_weight TEXT DEFAULT 'moderate',  -- quick/moderate/extended/flexible
  grouping TEXT DEFAULT 'individual',   -- individual/pair/small_group/whole_class/flexible
  phase TEXT,                           -- Format-neutral: uses FormatProfile phase IDs
  activity_category TEXT,               -- ideation/research/analysis/making/critique/reflection/planning/
                                        -- presentation/warmup/collaboration/skill-building/documentation/assessment/journey
  ai_rules JSONB,                      -- { phase, tone, rules[], forbidden_words[] }
  udl_checkpoints TEXT[],              -- ['1.1', '5.2', '7.1']
  success_look_fors TEXT[],            -- Observable success indicators

  -- Interaction metadata
  output_type TEXT,                     -- What artifact this activity produces
  prerequisite_tags TEXT[],            -- What artifacts are required upstream
  lesson_structure_role TEXT,           -- opening/instruction/core/reflection/warmup/wrapup
  response_type TEXT,                   -- short-text/long-text/canvas/toolkit-tool/upload/etc.
  toolkit_tool_id TEXT,                -- If response_type = 'toolkit-tool'

  -- Resources
  materials_needed TEXT[],
  tech_requirements TEXT[],
  scaffolding JSONB,
  example_response TEXT,

  -- Quality signals (System 4 feeds these)
  efficacy_score FLOAT DEFAULT 50,
  times_used INT DEFAULT 0,
  times_skipped INT DEFAULT 0,
  times_edited INT DEFAULT 0,
  avg_time_spent FLOAT,
  avg_completion_rate FLOAT,

  -- Format context
  source_format_hint TEXT,

  -- Search & discovery
  embedding halfvec(1024),
  fts tsvector,
  tags TEXT[],

  -- Assessment & interactive fields
  is_assessable BOOLEAN DEFAULT false,
  assessment_config JSONB,             -- { rubric_criteria, assessment_type, scoring_method, rubric_descriptors? }
  interactive_config JSONB,            -- { component_id, tool_config, ai_endpoint?, state_schema?, requires_challenge }
  supports_visual_assessment BOOLEAN DEFAULT false,

  -- Data integrity
  pii_scanned BOOLEAN DEFAULT false,
  pii_flags JSONB,
  copyright_flag TEXT DEFAULT 'own',   -- 'own' | 'copyrighted' | 'creative_commons' | 'unknown'
  teacher_verified BOOLEAN DEFAULT false,

  -- Loominary OS migration seams
  module TEXT DEFAULT 'studioloom',
  media_asset_ids UUID[],

  -- Lifecycle
  is_public BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blocks_teacher ON activity_blocks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_blocks_bloom ON activity_blocks(bloom_level);
CREATE INDEX IF NOT EXISTS idx_blocks_phase ON activity_blocks(phase);
CREATE INDEX IF NOT EXISTS idx_blocks_category ON activity_blocks(activity_category);
CREATE INDEX IF NOT EXISTS idx_blocks_time ON activity_blocks(time_weight);
CREATE INDEX IF NOT EXISTS idx_blocks_efficacy ON activity_blocks(efficacy_score);
CREATE INDEX IF NOT EXISTS idx_blocks_source ON activity_blocks(source_type);
CREATE INDEX IF NOT EXISTS idx_blocks_module ON activity_blocks(module);
CREATE INDEX IF NOT EXISTS idx_blocks_embedding ON activity_blocks USING ivfflat (embedding halfvec_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_blocks_fts ON activity_blocks USING gin (fts);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_activity_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_activity_blocks_updated_at ON activity_blocks;
CREATE TRIGGER trigger_activity_blocks_updated_at
  BEFORE UPDATE ON activity_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_activity_blocks_updated_at();

-- RLS policies
ALTER TABLE activity_blocks ENABLE ROW LEVEL SECURITY;

-- Teachers can read their own blocks + public blocks
CREATE POLICY activity_blocks_select ON activity_blocks
  FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR is_public = true
  );

-- Teachers can insert their own blocks
CREATE POLICY activity_blocks_insert ON activity_blocks
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

-- Teachers can update their own blocks
CREATE POLICY activity_blocks_update ON activity_blocks
  FOR UPDATE
  USING (teacher_id = auth.uid());

-- Teachers can delete their own blocks
CREATE POLICY activity_blocks_delete ON activity_blocks
  FOR DELETE
  USING (teacher_id = auth.uid());
