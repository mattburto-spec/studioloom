-- 005_lms_integration.sql
-- Adds LMS integration support (ManageBac first, extensible to Toddle, Canvas, etc.)
-- Run this in the Supabase SQL Editor

-- ============================================================
-- Teacher LMS integration config (provider-agnostic)
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'managebac',  -- 'managebac', 'toddle', 'canvas', etc.
  subdomain TEXT,                               -- e.g. 'myschool' for myschool.managebac.com
  encrypted_api_token TEXT,                     -- AES-256-GCM encrypted
  lti_consumer_key TEXT UNIQUE,                 -- shared across all LMS (LTI is standard)
  lti_consumer_secret TEXT,                     -- encrypted
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Generic external IDs for ANY LMS (not provider-specific)
-- ============================================================

-- Students: track which LMS student ID they correspond to
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_provider TEXT;

-- Classes: track which LMS class is linked
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS external_class_id TEXT,
  ADD COLUMN IF NOT EXISTS external_provider TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_teacher_integrations_lti_key
  ON teacher_integrations(lti_consumer_key);

CREATE INDEX IF NOT EXISTS idx_students_external_id
  ON students(external_id);

-- ============================================================
-- RLS: teachers can only see/edit their own integrations
-- ============================================================
ALTER TABLE teacher_integrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'teacher_integrations'
    AND policyname = 'Teachers manage own integrations'
  ) THEN
    CREATE POLICY "Teachers manage own integrations"
      ON teacher_integrations
      FOR ALL
      USING (teacher_id = auth.uid())
      WITH CHECK (teacher_id = auth.uid());
  END IF;
END $$;
