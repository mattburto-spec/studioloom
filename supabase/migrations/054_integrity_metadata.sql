-- Migration 054: Add integrity_metadata JSONB to student_progress
-- Stores academic integrity monitoring data from MonitoredTextarea
-- (paste events, keystroke counts, focus time, text snapshots, etc.)
-- Analyzed by analyzeIntegrity() to produce a deterministic 0-100 score

ALTER TABLE student_progress
  ADD COLUMN IF NOT EXISTS integrity_metadata JSONB DEFAULT NULL;

-- Index for teacher queries: "show me flagged students"
-- Only index rows that actually have integrity data
CREATE INDEX IF NOT EXISTS idx_student_progress_integrity
  ON student_progress (student_id, unit_id)
  WHERE integrity_metadata IS NOT NULL;

COMMENT ON COLUMN student_progress.integrity_metadata IS
  'Academic integrity monitoring data from MonitoredTextarea. JSONB containing per-section metadata keyed by response key (e.g. activity_abc123). Each value has: pasteEvents, totalTimeActive, keystrokeCount, focusLossCount, characterCount, deletionCount, snapshots, wordCountHistory, startTime.';
