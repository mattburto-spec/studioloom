-- Migration 003: Due dates, page settings, unit images
-- Covers Features 1 (due dates), 2 (page toggles), 3 (unit images uses existing thumbnail_url)

-- ============================================================
-- FEATURE 1: Due Dates (per class-unit)
-- ============================================================

ALTER TABLE class_units
  ADD COLUMN final_due_date DATE,
  ADD COLUMN strand_a_due_date DATE,
  ADD COLUMN strand_b_due_date DATE,
  ADD COLUMN strand_c_due_date DATE,
  ADD COLUMN strand_d_due_date DATE;

-- ============================================================
-- FEATURE 2: Per-Page Settings
-- ============================================================
-- Structure: { "1": { "enabled": true, "assessment_type": "formative",
--   "allowed_response_types": ["text","upload","voice","sketch"],
--   "export_pdf": false }, ... }
-- Empty {} means all pages use defaults (backward compatible)

ALTER TABLE class_units
  ADD COLUMN page_settings JSONB NOT NULL DEFAULT '{}';

-- Index for teacher queries on due dates
CREATE INDEX idx_class_units_due_dates
  ON class_units(class_id, final_due_date);
