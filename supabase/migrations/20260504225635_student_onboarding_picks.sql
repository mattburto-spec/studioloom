-- Migration: student_onboarding_picks
-- Created: 20260504225635 UTC
--
-- WHY: v1 of the redesigned student onboarding ("Discover Your Design DNA")
-- starts with 9 visual mood tiles. The picks are used to suggest a mentor on
-- the next screen. Persisting them lets v2 (Designer Mentor System with 20
-- real-world designers + cosine-similarity matching) re-run matching against
-- the new pool without re-onboarding existing students. Spec destination:
-- docs/projects/studioloom-designer-mentor-spec.md.
--
-- IMPACT: students.onboarding_picks JSONB nullable. Stores array of image IDs
-- like ["warm","sketch","loud"] from src/lib/student/onboarding-images.ts.
-- No RLS changes — covered by existing students-table policies. No index
-- (column is read per-student on profile load, never queried for filtering).
-- ROLLBACK: paired .down.sql drops the column.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS onboarding_picks JSONB;

COMMENT ON COLUMN students.onboarding_picks IS
  'Array of image IDs picked during v1 visual-picks onboarding (e.g. ["warm","sketch","loud"]). Null for pre-v1-onboarding students. Feeds v2 cosine-similarity rematch when Designer Mentor System ships.';
