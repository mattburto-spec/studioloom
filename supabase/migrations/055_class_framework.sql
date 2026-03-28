-- Migration 055: Add framework column to classes table
-- Part of MYPflex project — makes platform framework-flexible (MYP, GCSE, ACARA, A-Level, etc.)
-- Framework lives on the CLASS because the same unit can be taught under different frameworks
-- Default to IB_MYP for backward compatibility with existing data

ALTER TABLE classes ADD COLUMN IF NOT EXISTS framework TEXT DEFAULT 'IB_MYP';

-- Index for filtering by framework
CREATE INDEX IF NOT EXISTS idx_classes_framework ON classes(framework);

-- Comment for documentation
COMMENT ON COLUMN classes.framework IS 'Curriculum framework ID (IB_MYP, GCSE_DT, ACARA_DT, A_LEVEL_DT, IGCSE_DT, PLTW). Determines grading scale, criteria, and AI generation vocabulary.';
