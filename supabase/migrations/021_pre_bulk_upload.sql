-- 021: Pre-bulk upload enhancements
-- Original file storage, collections, teacher profiles, expanded source categories
-- Run BEFORE doing large batch uploads to preserve originals and organize content

-- 1. Store path to original uploaded file in Supabase storage
ALTER TABLE knowledge_uploads
  ADD COLUMN IF NOT EXISTS original_file_path TEXT;

COMMENT ON COLUMN knowledge_uploads.original_file_path IS
  'Supabase storage path to the original uploaded file (PDF/DOCX/PPTX). Enables re-extraction with improved tools.';

-- 2. Collections for organizing uploads into groups
ALTER TABLE knowledge_uploads
  ADD COLUMN IF NOT EXISTS collection TEXT;

COMMENT ON COLUMN knowledge_uploads.collection IS
  'Optional grouping label, e.g. "Nelson Textbook Ch1-5", "Year 10 Textiles". Set at upload time.';

CREATE INDEX IF NOT EXISTS idx_knowledge_uploads_collection
  ON knowledge_uploads(collection) WHERE collection IS NOT NULL;

-- Also add collection to knowledge_items
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS collection TEXT;

COMMENT ON COLUMN knowledge_items.collection IS
  'Optional grouping label for organizing library items. Auto-populated from upload collection.';

CREATE INDEX IF NOT EXISTS idx_knowledge_items_collection
  ON knowledge_items(collection) WHERE collection IS NOT NULL;

-- 3. Teacher profiles table — school context + teaching preferences
CREATE TABLE IF NOT EXISTS teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- School context (JSONB for flexibility — matches SchoolContext type)
  school_context JSONB NOT NULL DEFAULT '{}',

  -- Teacher preferences (JSONB — matches TeacherPreferences type)
  teacher_preferences JSONB NOT NULL DEFAULT '{}',

  -- Quick access fields (denormalized for filtering/display)
  school_name TEXT,
  country TEXT,
  curriculum_framework TEXT,
  typical_period_minutes INTEGER,
  subjects_taught TEXT[] NOT NULL DEFAULT '{}',
  grade_levels_taught TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(teacher_id)
);

COMMENT ON TABLE teacher_profiles IS
  'School context and teaching preferences per teacher. Feeds into AI analysis prompts and unit generation.';

-- RLS policies
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own profile"
  ON teacher_profiles FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can insert own profile"
  ON teacher_profiles FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own profile"
  ON teacher_profiles FOR UPDATE
  USING (auth.uid() = teacher_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_teacher_id
  ON teacher_profiles(teacher_id);

-- 4. Note on source_category: The column is TEXT (no CHECK constraint),
-- so new categories (student_exemplar, assessment_rubric, safety_document,
-- reference_image, scheme_of_work) work automatically without schema changes.
COMMENT ON COLUMN knowledge_uploads.source_category IS
  'Upload category: lesson_plan, textbook, resource, student_exemplar, assessment_rubric, safety_document, reference_image, scheme_of_work. Controls analysis behavior and library item type.';
