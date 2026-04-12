-- Migration 072: Library Health & Operational Automation (Phase 4)
-- New tables: system_alerts, library_health_flags, usage_rollups
-- New columns on activity_blocks: last_used_at, archived_at, embedding_generated_at, decay_applied_total
-- RPC function: find_duplicate_blocks() for cosine similarity duplicate detection

-- ============================================================================
-- 1. System Alerts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  payload JSONB NOT NULL DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at DESC);

-- ============================================================================
-- 2. Library Health Flags Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS library_health_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES activity_blocks(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  reason TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_flags_block ON library_health_flags(block_id);
CREATE INDEX IF NOT EXISTS idx_health_flags_unresolved ON library_health_flags(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- 3. Usage Rollups Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  teacher_id UUID,
  student_id UUID,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_type, period_start, teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_rollups_period ON usage_rollups(period_type, period_start);

-- ============================================================================
-- 4. New Columns on activity_blocks
-- ============================================================================
ALTER TABLE activity_blocks ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE activity_blocks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE activity_blocks ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMPTZ;
ALTER TABLE activity_blocks ADD COLUMN IF NOT EXISTS decay_applied_total INT DEFAULT 0;

-- ============================================================================
-- 5. RPC Function: find_duplicate_blocks
-- ============================================================================
-- Uses cosine similarity on halfvec(1024) embeddings to detect near-duplicate blocks
-- Similarity = 1 - distance (distance operator <=> returns 0 for identical, 2 for opposite)
-- Cast halfvec to vector for the <=> operator
CREATE OR REPLACE FUNCTION find_duplicate_blocks(
  min_similarity FLOAT DEFAULT 0.88,
  max_similarity FLOAT DEFAULT 0.92,
  max_results INT DEFAULT 50
)
RETURNS TABLE (
  block_a_id UUID,
  block_b_id UUID,
  similarity FLOAT,
  title_a TEXT,
  title_b TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS block_a_id,
    b.id AS block_b_id,
    (1 - (a.embedding::vector <=> b.embedding::vector))::FLOAT AS similarity,
    a.title AS title_a,
    b.title AS title_b
  FROM activity_blocks a
  JOIN activity_blocks b ON a.id < b.id
  WHERE a.embedding IS NOT NULL
    AND b.embedding IS NOT NULL
    AND a.is_archived IS NOT TRUE
    AND b.is_archived IS NOT TRUE
    AND (1 - (a.embedding::vector <=> b.embedding::vector)) BETWEEN min_similarity AND max_similarity
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;
