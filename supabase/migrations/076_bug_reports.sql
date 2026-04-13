-- Migration 076: bug_reports table + classes.bug_reporting_enabled
--
-- Bug Reporting System (spec §9.13). Captures browser context, console
-- errors, screenshots. Admin triage in /admin/bug-reports (Phase 7H).
--
-- reporter_id has NO FK constraint because the reporter can be a teacher
-- (auth.users), student (students table), or admin (auth.users).
-- reporter_role disambiguates.
--
-- class_id ON DELETE SET NULL preserves audit trail when a class is deleted.

-- ============================================================
-- 1. CREATE TABLE bug_reports
-- ============================================================

CREATE TABLE IF NOT EXISTS bug_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID NOT NULL,
  reporter_role    TEXT NOT NULL CHECK (reporter_role IN ('teacher', 'student', 'admin')),
  class_id         UUID REFERENCES classes(id) ON DELETE SET NULL,
  category         TEXT NOT NULL CHECK (category IN ('broken', 'visual', 'confused', 'feature_request')),
  description      TEXT NOT NULL,
  screenshot_url   TEXT,
  page_url         TEXT,
  console_errors   JSONB DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'fixed', 'closed')),
  admin_notes      TEXT,
  response         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for triage and lookup
CREATE INDEX IF NOT EXISTS idx_bug_reports_status
  ON bug_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bug_reports_class
  ON bug_reports (class_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bug_reports_reporter
  ON bug_reports (reporter_id, created_at DESC);

-- ============================================================
-- 2. RLS on bug_reports
-- ============================================================

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can read their own reports
CREATE POLICY "Reporters read own bug reports"
  ON bug_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- Reporters can insert their own reports
CREATE POLICY "Reporters insert own bug reports"
  ON bug_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- Service role full access (admin triage, status updates, response)
CREATE POLICY "Service role full access bug_reports"
  ON bug_reports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 3. Add bug_reporting_enabled to classes
--    Wrapped in DO block per Lesson #24 (idempotent column add).
-- ============================================================

DO $$ BEGIN
  ALTER TABLE classes ADD COLUMN bug_reporting_enabled BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
