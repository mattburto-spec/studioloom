-- ============================================================
-- Migration 023: Quality Report Persistence (Layer 4)
-- Store quality evaluation results on units for history tracking
-- ============================================================

-- Add quality_report JSONB column to units table
-- Stores the full QualityReport from the quality evaluator
ALTER TABLE units ADD COLUMN IF NOT EXISTS quality_report JSONB;

-- Add teacher_id column reference for units (tracks who created the unit)
-- Some units may already have author_teacher_id from migration 007
ALTER TABLE units ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id);

-- Index for finding units with/without quality reports
CREATE INDEX IF NOT EXISTS idx_units_quality_report
  ON units ((quality_report IS NOT NULL));
