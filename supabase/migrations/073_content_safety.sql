-- Migration 073: Content Safety & Moderation (student-facing)
--
-- Phase 5A of Dimensions3 v2 Completion Build.
-- Adds moderation columns to student_progress and creates a
-- student_content_moderation_log table for tracking moderation decisions
-- on student-authored content.
--
-- NOTE: This is SEPARATE from migration 067's content_moderation_log which
-- handles ingestion-side (activity_block) moderation. That table and its
-- consumers are untouched (Lesson #45). This table is named
-- student_content_moderation_log to avoid collision.
--
-- Lesson #24: Wrap ALTER TABLE ADD COLUMN in DO $$ blocks with
-- EXCEPTION WHEN duplicate_column to handle re-runs safely.
--
-- Lesson #38: DEFAULT 'pending' is correct here — there is NO conditional
-- backfill. All existing student_progress rows were never moderated and
-- genuinely should be 'pending'. Phase 5E will set rows to 'clean' as
-- they pass moderation.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. student_progress — add moderation columns
-- ─────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE student_progress
    ADD COLUMN moderation_status TEXT DEFAULT 'pending'
      CHECK (moderation_status IN ('clean', 'pending', 'flagged', 'blocked'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE student_progress
    ADD COLUMN moderation_flags JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. student_content_moderation_log — incident tracking for student content
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_content_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  content_source TEXT NOT NULL
    CHECK (content_source IN (
      'student_progress', 'tool_session', 'gallery_post', 'peer_review',
      'quest_evidence', 'quest_sharing', 'portfolio', 'upload_image'
    )),
  content_hash TEXT,
  moderation_layer TEXT NOT NULL
    CHECK (moderation_layer IN ('client_text', 'client_image', 'server_haiku')),
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_result TEXT NOT NULL
    CHECK (overall_result IN ('clean', 'flagged', 'blocked')),
  severity TEXT NOT NULL
    CHECK (severity IN ('info', 'warning', 'critical')),
  action_taken TEXT,
  teacher_reviewed BOOLEAN DEFAULT false,
  teacher_action TEXT,
  teacher_reviewed_at TIMESTAMPTZ,
  raw_ai_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_student_moderation_log_class_severity
  ON student_content_moderation_log(class_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_moderation_log_student
  ON student_content_moderation_log(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_moderation_log_unreviewed
  ON student_content_moderation_log(teacher_reviewed, created_at DESC)
  WHERE teacher_reviewed = false;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RLS policies
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE student_content_moderation_log ENABLE ROW LEVEL SECURITY;

-- Teachers can read moderation log rows for their own classes
CREATE POLICY student_moderation_log_teacher_select
  ON student_content_moderation_log
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

-- Teachers can update review fields on their own classes' rows
CREATE POLICY student_moderation_log_teacher_update
  ON student_content_moderation_log
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

-- Service role has full access (implicit via RLS bypass, but explicit
-- policy ensures non-service authenticated roles are denied by default)
CREATE POLICY student_moderation_log_service_all
  ON student_content_moderation_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
