-- Migration 043: Add graduation_year to students
-- Stores the year a student will graduate secondary school (e.g. 2028).
-- This is auto-calculated from the year level the teacher selects (e.g. Year 9)
-- using the formula: graduation_year = academic_end_year + (13 - year_level).
-- The graduation_year is the STABLE anchor — it never changes. The displayed
-- year level is derived from it each academic year, so students auto-advance.
-- Teachers pick "Year 9" in the UI; the system stores graduation_year = 2030.

-- 1. Add graduation_year column (nullable — teachers set it gradually)
ALTER TABLE students ADD COLUMN IF NOT EXISTS graduation_year INTEGER;

-- 2. Index for filtering students by graduation year
CREATE INDEX IF NOT EXISTS idx_students_graduation_year
  ON students(graduation_year)
  WHERE graduation_year IS NOT NULL;

-- 3. Composite index: teacher + graduation year (common query pattern)
CREATE INDEX IF NOT EXISTS idx_students_teacher_grad_year
  ON students(author_teacher_id, graduation_year);
