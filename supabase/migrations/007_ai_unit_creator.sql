-- Migration 007: AI Unit Creator + Global Repository
-- Safe to re-run (uses IF NOT EXISTS / IF NOT)

-- ========== REPOSITORY COLUMNS ON UNITS TABLE ==========

ALTER TABLE units ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE units ADD COLUMN IF NOT EXISTS author_teacher_id UUID REFERENCES auth.users(id);
ALTER TABLE units ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE units ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS duration_weeks INTEGER;
ALTER TABLE units ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS global_context TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS key_concept TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS fork_count INTEGER DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS forked_from UUID REFERENCES units(id);

-- Indexes for repository browsing
CREATE INDEX IF NOT EXISTS idx_units_published ON units(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_units_tags ON units USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_units_grade_level ON units(grade_level);
CREATE INDEX IF NOT EXISTS idx_units_author ON units(author_teacher_id);

-- ========== AI SETTINGS TABLE ==========

CREATE TABLE IF NOT EXISTS ai_settings (
  teacher_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai-compatible',
  api_endpoint TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  model_name TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  encrypted_api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for ai_settings
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Teachers manage own AI settings' AND tablename = 'ai_settings'
  ) THEN
    CREATE POLICY "Teachers manage own AI settings"
      ON ai_settings FOR ALL
      USING (teacher_id = auth.uid())
      WITH CHECK (teacher_id = auth.uid());
  END IF;
END
$$;

-- RLS: all teachers can read published units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Teachers read published units' AND tablename = 'units'
  ) THEN
    CREATE POLICY "Teachers read published units"
      ON units FOR SELECT
      USING (is_published = true);
  END IF;
END
$$;
