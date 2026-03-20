-- Migration 027: Add teacher style profile column
-- Stores the learned TeacherStyleProfile as JSONB on the teachers table.
-- Profile accumulates over time from passive signals (uploads, edits, grading).

ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS style_profile JSONB DEFAULT NULL;

-- Index for querying teachers by confidence level
CREATE INDEX IF NOT EXISTS idx_teachers_style_confidence
ON teachers ((style_profile->>'confidenceLevel'));

COMMENT ON COLUMN teachers.style_profile IS 'Learned teaching style profile (TeacherStyleProfile). Accumulated from uploads, edits, and grading patterns. See docs/ai-intelligence-architecture.md §4.';
