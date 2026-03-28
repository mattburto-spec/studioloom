-- Migration 053: Composite indexes for common query patterns
-- Improves performance on gallery browsing, NM results, student dashboard, and toolkit resume

-- Gallery: browsing submissions by round + student
CREATE INDEX IF NOT EXISTS idx_gallery_submissions_round_student
  ON gallery_submissions (round_id, student_id);

-- Gallery: counting reviews per submission
CREATE INDEX IF NOT EXISTS idx_gallery_reviews_submission
  ON gallery_reviews (submission_id);

-- NM: results aggregation by student + unit + source
CREATE INDEX IF NOT EXISTS idx_competency_assessments_student_unit_source
  ON competency_assessments (student_id, unit_id, source);

-- Student progress: dashboard queries by student + unit
CREATE INDEX IF NOT EXISTS idx_student_progress_student_unit
  ON student_progress (student_id, unit_id);

-- Toolkit sessions: resume lookup by student + tool + status
CREATE INDEX IF NOT EXISTS idx_tool_sessions_student_tool_status
  ON student_tool_sessions (student_id, tool_id, status);

-- Discovery sessions: lookup by student + unit
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_student_unit
  ON discovery_sessions (student_id, unit_id);
