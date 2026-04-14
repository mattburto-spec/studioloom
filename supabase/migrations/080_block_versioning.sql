-- Migration 080: Activity Block Versioning
-- Part of Dimensions3 Phase 7A — Integrity & Versioning (§8.2)
-- Creates version history table + auto-trigger on activity_blocks UPDATE.
-- Every UPDATE snapshots the OLD row before mutation.

CREATE TABLE IF NOT EXISTS activity_block_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES activity_blocks(id) ON DELETE CASCADE,
  version_number INT NOT NULL,

  -- Snapshot of the block at the time of change
  title TEXT,
  prompt TEXT,
  description TEXT,
  efficacy_score FLOAT,
  bloom_level TEXT,
  time_weight TEXT,
  phase TEXT,
  grouping TEXT,
  activity_category TEXT,
  tags TEXT[],
  materials_needed TEXT[],
  moderation_status TEXT,
  ai_rules JSONB,
  scaffolding JSONB,

  -- Audit
  edited_by UUID,
  edit_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(block_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_block_versions_block
  ON activity_block_versions(block_id, version_number DESC);

-- RLS
ALTER TABLE activity_block_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers read own block versions" ON activity_block_versions
  FOR SELECT USING (
    block_id IN (
      SELECT id FROM activity_blocks WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access block versions" ON activity_block_versions
  FOR ALL USING (auth.role() = 'service_role');

-- Auto-version trigger: snapshots OLD row on every UPDATE
CREATE OR REPLACE FUNCTION snapshot_block_version() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_block_versions (
    block_id, version_number,
    title, prompt, description, efficacy_score,
    bloom_level, time_weight, phase, grouping, activity_category,
    tags, materials_needed, moderation_status, ai_rules, scaffolding
  ) VALUES (
    OLD.id,
    COALESCE(
      (SELECT MAX(version_number) FROM activity_block_versions WHERE block_id = OLD.id),
      0
    ) + 1,
    OLD.title, OLD.prompt, OLD.description, OLD.efficacy_score,
    OLD.bloom_level, OLD.time_weight, OLD.phase, OLD.grouping, OLD.activity_category,
    OLD.tags, OLD.materials_needed, OLD.moderation_status, OLD.ai_rules, OLD.scaffolding
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_blocks_version
  BEFORE UPDATE ON activity_blocks
  FOR EACH ROW EXECUTE FUNCTION snapshot_block_version();
