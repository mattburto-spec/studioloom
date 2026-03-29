-- Migration 058: Add Dimensions v2 metadata columns to knowledge_chunks
-- Adds bloom_level, grouping, and udl_checkpoints for enriched RAG retrieval filtering.
-- These are populated by the Phase 2 chunk enrichment pipeline (derivePhaseGrouping,
-- derivePhaseUdlCheckpoints) when lessons are uploaded to the knowledge base.

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS bloom_level TEXT,
  ADD COLUMN IF NOT EXISTS grouping TEXT,
  ADD COLUMN IF NOT EXISTS udl_checkpoints TEXT[] DEFAULT '{}';

-- Index for filtered retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_bloom ON knowledge_chunks (bloom_level) WHERE bloom_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_grouping ON knowledge_chunks (grouping) WHERE grouping IS NOT NULL;
