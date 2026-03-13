-- Migration 012: Portfolio capture — add page/section tracking to portfolio_entries

-- Add columns for auto-capture source tracking
ALTER TABLE portfolio_entries ADD COLUMN IF NOT EXISTS page_id TEXT;
ALTER TABLE portfolio_entries ADD COLUMN IF NOT EXISTS section_index INTEGER;

-- Allow 'auto' as a type
ALTER TABLE portfolio_entries DROP CONSTRAINT IF EXISTS portfolio_entries_type_check;
ALTER TABLE portfolio_entries ADD CONSTRAINT portfolio_entries_type_check
  CHECK (type IN ('entry', 'photo', 'link', 'note', 'mistake', 'auto'));

-- Unique constraint for deduplication: one auto-captured entry per (student, unit, page, section)
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_auto_capture_unique
  ON portfolio_entries(student_id, unit_id, page_id, section_index)
  WHERE page_id IS NOT NULL AND section_index IS NOT NULL;
