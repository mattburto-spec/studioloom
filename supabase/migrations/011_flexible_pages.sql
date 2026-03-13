-- Migration 011: Flexible page lists
-- Removes the fixed 16-page constraint, adds page_id column for flexible unit structures.

-- 1. Add page_id column to student_progress (nullable initially for backfill)
ALTER TABLE student_progress
  ADD COLUMN IF NOT EXISTS page_id TEXT;

-- 2. Backfill page_id from page_number for existing rows
UPDATE student_progress SET page_id = CASE page_number
  WHEN 1 THEN 'A1' WHEN 2 THEN 'A2' WHEN 3 THEN 'A3' WHEN 4 THEN 'A4'
  WHEN 5 THEN 'B1' WHEN 6 THEN 'B2' WHEN 7 THEN 'B3' WHEN 8 THEN 'B4'
  WHEN 9 THEN 'C1' WHEN 10 THEN 'C2' WHEN 11 THEN 'C3' WHEN 12 THEN 'C4'
  WHEN 13 THEN 'D1' WHEN 14 THEN 'D2' WHEN 15 THEN 'D3' WHEN 16 THEN 'D4'
END
WHERE page_id IS NULL AND page_number IS NOT NULL;

-- 3. Make page_id NOT NULL after backfill
ALTER TABLE student_progress ALTER COLUMN page_id SET NOT NULL;

-- 4. Drop the old CHECK constraint on page_number
ALTER TABLE student_progress DROP CONSTRAINT IF EXISTS student_progress_page_number_check;

-- 5. Drop the old UNIQUE constraint and add new one on page_id
ALTER TABLE student_progress DROP CONSTRAINT IF EXISTS student_progress_student_id_unit_id_page_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_progress_unique_v2
  ON student_progress(student_id, unit_id, page_id);

-- 6. Add page_id to planning_tasks
ALTER TABLE planning_tasks
  ADD COLUMN IF NOT EXISTS page_id TEXT;

-- Backfill planning_tasks page_id from page_number
UPDATE planning_tasks SET page_id = CASE page_number
  WHEN 1 THEN 'A1' WHEN 2 THEN 'A2' WHEN 3 THEN 'A3' WHEN 4 THEN 'A4'
  WHEN 5 THEN 'B1' WHEN 6 THEN 'B2' WHEN 7 THEN 'B3' WHEN 8 THEN 'B4'
  WHEN 9 THEN 'C1' WHEN 10 THEN 'C2' WHEN 11 THEN 'C3' WHEN 12 THEN 'C4'
  WHEN 13 THEN 'D1' WHEN 14 THEN 'D2' WHEN 15 THEN 'D3' WHEN 16 THEN 'D4'
END
WHERE page_id IS NULL AND page_number IS NOT NULL;

-- Drop old CHECK constraint on planning_tasks page_number if exists
ALTER TABLE planning_tasks DROP CONSTRAINT IF EXISTS planning_tasks_page_number_check;

-- 7. Add locked_page_ids TEXT[] to class_units (replaces INTEGER[] locked_pages)
ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS locked_page_ids TEXT[] DEFAULT '{}';

-- Backfill locked_page_ids from locked_pages
UPDATE class_units SET locked_page_ids = ARRAY(
  SELECT CASE elem
    WHEN 1 THEN 'A1' WHEN 2 THEN 'A2' WHEN 3 THEN 'A3' WHEN 4 THEN 'A4'
    WHEN 5 THEN 'B1' WHEN 6 THEN 'B2' WHEN 7 THEN 'B3' WHEN 8 THEN 'B4'
    WHEN 9 THEN 'C1' WHEN 10 THEN 'C2' WHEN 11 THEN 'C3' WHEN 12 THEN 'C4'
    WHEN 13 THEN 'D1' WHEN 14 THEN 'D2' WHEN 15 THEN 'D3' WHEN 16 THEN 'D4'
  END
  FROM unnest(locked_pages) AS elem
)
WHERE locked_pages IS NOT NULL AND array_length(locked_pages, 1) > 0;

-- 8. Index for new page_id queries
CREATE INDEX IF NOT EXISTS idx_student_progress_page_id
  ON student_progress(student_id, unit_id, page_id);

-- Note: old columns (page_number, locked_pages) are kept during transition.
-- A follow-up migration will drop them once all code paths use page_id.
