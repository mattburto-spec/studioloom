-- Migration 082: Data Removal Audit Log
-- Part of Dimensions3 Phase 7A — Integrity & Versioning (§8.3)
-- Tracks student data removal/anonymization for GDPR compliance.

CREATE TABLE IF NOT EXISTS data_removal_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  removed_student_ref TEXT NOT NULL,      -- Original student ID (kept as text for audit after deletion)
  removed_by UUID,                        -- Admin/teacher who performed the removal
  reason TEXT NOT NULL,                   -- 'gdpr_request' | 'student_left' | 'parent_request' | 'other'
  row_counts JSONB NOT NULL DEFAULT '{}', -- { student_progress: 5, tool_sessions: 3, ... }
  dry_run BOOLEAN DEFAULT false,          -- true if this was a dry-run (no data actually changed)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_removal_log_created
  ON data_removal_log(created_at DESC);

-- RLS: service_role only (admin action)
ALTER TABLE data_removal_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access data removal log" ON data_removal_log
  FOR ALL USING (auth.role() = 'service_role');
