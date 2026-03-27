-- Migration 052: Add thumbnail_url to units table
-- Teachers can choose a curated gallery image or upload their own

ALTER TABLE units ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;

-- Index for quick lookups (nullable, sparse)
CREATE INDEX IF NOT EXISTS idx_units_thumbnail ON units (id) WHERE thumbnail_url IS NOT NULL;
