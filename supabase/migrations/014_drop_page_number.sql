-- Migration 014: Complete flexible pages migration
-- Drops deprecated columns that were kept during the transition period (migration 011).
-- All code now uses page_id (TEXT) instead of page_number (INTEGER).

-- student_progress: drop deprecated page_number
ALTER TABLE student_progress DROP COLUMN IF EXISTS page_number;

-- planning_tasks: drop deprecated page_number
ALTER TABLE planning_tasks DROP COLUMN IF EXISTS page_number;

-- class_units: drop deprecated locked_pages (replaced by locked_page_ids TEXT[])
ALTER TABLE class_units DROP COLUMN IF EXISTS locked_pages;
