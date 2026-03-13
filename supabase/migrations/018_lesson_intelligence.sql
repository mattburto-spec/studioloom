-- 018: Lesson Intelligence — AI-powered lesson analysis + feedback loop
-- Stores structured pedagogical analysis (LessonProfile) from 3-pass AI analysis,
-- teacher/student post-lesson feedback, and enriches the upload pipeline.

-- ============================================================
-- 1. Expand knowledge_uploads status to support analysis stages
-- ============================================================

ALTER TABLE knowledge_uploads
  DROP CONSTRAINT IF EXISTS knowledge_uploads_status_check;

ALTER TABLE knowledge_uploads
  ADD CONSTRAINT knowledge_uploads_status_check
  CHECK (status IN (
    'processing',   -- extracting text
    'extracted',     -- text extracted, awaiting analysis
    'analysing',     -- 3-pass AI analysis running
    'analysed',      -- analysis complete, awaiting teacher review
    'complete',      -- teacher reviewed + chunks stored
    'failed'         -- any stage failed
  ));

-- Add analysis tracking columns to knowledge_uploads
ALTER TABLE knowledge_uploads
  ADD COLUMN IF NOT EXISTS analysis_stage TEXT,
  ADD COLUMN IF NOT EXISTS raw_extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS lesson_profile_id UUID;

-- ============================================================
-- 2. Lesson Profiles table
-- Stores the complete LessonProfile from 3-pass AI analysis
-- ============================================================

CREATE TABLE lesson_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  upload_id UUID REFERENCES knowledge_uploads(id) ON DELETE SET NULL,

  -- AI-extracted identity
  title TEXT NOT NULL,
  subject_area TEXT,
  grade_level TEXT,
  estimated_duration_minutes INT,
  lesson_type TEXT DEFAULT 'single_lesson',

  -- Searchable pedagogical fields (denormalized from profile_data for filtering)
  pedagogical_approach TEXT,
  scaffolding_model TEXT,
  complexity_level TEXT,
  criteria_covered TEXT[] DEFAULT '{}',

  -- Full structured analysis (complete LessonProfile as JSONB)
  profile_data JSONB NOT NULL,

  -- Raw data — never discard (enables re-analysis when prompts improve)
  raw_extracted_text TEXT NOT NULL,
  analysis_version TEXT NOT NULL,
  analysis_model TEXT NOT NULL,

  -- For hybrid search (vector + FTS)
  embedding halfvec(1024),
  fts tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(subject_area, '') || ' ' ||
      coalesce(grade_level, '') || ' ' ||
      coalesce(pedagogical_approach, '') || ' ' ||
      coalesce(scaffolding_model, '')
    )
  ) STORED,

  -- Quality & trust signals
  teacher_verified BOOLEAN DEFAULT false,
  teacher_corrections JSONB,
  times_referenced INT DEFAULT 0,
  teacher_quality_rating SMALLINT CHECK (teacher_quality_rating BETWEEN 1 AND 5),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. Lesson Feedback table
-- Post-lesson reflections from teachers and students
-- ============================================================

CREATE TABLE lesson_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_profile_id UUID REFERENCES lesson_profiles(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Context: which unit/page/class was this used in?
  unit_id UUID,
  page_id TEXT,
  class_id TEXT,

  -- Feedback source
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('teacher', 'student')),

  -- Full feedback payload (TeacherPostLessonFeedback or StudentPostLessonFeedback)
  feedback_data JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. Indexes
-- ============================================================

-- Lesson profiles: HNSW vector index for fast similarity search
CREATE INDEX lesson_profiles_embedding_idx
  ON lesson_profiles USING hnsw (embedding halfvec_cosine_ops);

-- Lesson profiles: full-text search
CREATE INDEX lesson_profiles_fts_idx
  ON lesson_profiles USING gin (fts);

-- Lesson profiles: common filter columns
CREATE INDEX lesson_profiles_teacher_idx ON lesson_profiles (teacher_id);
CREATE INDEX lesson_profiles_subject_idx ON lesson_profiles (subject_area);
CREATE INDEX lesson_profiles_grade_idx ON lesson_profiles (grade_level);
CREATE INDEX lesson_profiles_approach_idx ON lesson_profiles (pedagogical_approach);
CREATE INDEX lesson_profiles_criteria_idx ON lesson_profiles USING gin (criteria_covered);
CREATE INDEX lesson_profiles_upload_idx ON lesson_profiles (upload_id);
CREATE INDEX lesson_profiles_verified_idx ON lesson_profiles (teacher_verified)
  WHERE teacher_verified = true;

-- Lesson feedback: lookup indexes
CREATE INDEX lesson_feedback_profile_idx ON lesson_feedback (lesson_profile_id);
CREATE INDEX lesson_feedback_teacher_idx ON lesson_feedback (teacher_id);
CREATE INDEX lesson_feedback_unit_idx ON lesson_feedback (unit_id) WHERE unit_id IS NOT NULL;

-- ============================================================
-- 5. RLS Policies
-- ============================================================

ALTER TABLE lesson_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_feedback ENABLE ROW LEVEL SECURITY;

-- Teachers manage their own profiles
CREATE POLICY "Teachers manage own profiles"
  ON lesson_profiles FOR ALL
  USING (teacher_id = auth.uid());

-- Service role full access (for background processing / API routes)
CREATE POLICY "Service role full access profiles"
  ON lesson_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Teachers manage their own feedback
CREATE POLICY "Teachers manage own feedback"
  ON lesson_feedback FOR ALL
  USING (teacher_id = auth.uid());

-- Service role full access feedback
CREATE POLICY "Service role full access feedback"
  ON lesson_feedback FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 6. Hybrid search RPC for lesson profiles
-- Weighted scoring: similarity + text + verified + referenced + rating
-- ============================================================

CREATE OR REPLACE FUNCTION match_lesson_profiles(
  query_embedding halfvec(1024),
  query_text TEXT DEFAULT '',
  match_count INT DEFAULT 10,
  filter_subject TEXT DEFAULT NULL,
  filter_grade TEXT DEFAULT NULL,
  filter_criteria TEXT[] DEFAULT NULL,
  filter_approach TEXT DEFAULT NULL,
  filter_teacher_id UUID DEFAULT NULL,
  only_verified BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  subject_area TEXT,
  grade_level TEXT,
  pedagogical_approach TEXT,
  complexity_level TEXT,
  criteria_covered TEXT[],
  profile_data JSONB,
  similarity FLOAT,
  final_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH scored AS (
    SELECT
      lp.id, lp.title, lp.subject_area, lp.grade_level,
      lp.pedagogical_approach, lp.complexity_level,
      lp.criteria_covered, lp.profile_data,
      1 - (lp.embedding <=> query_embedding) AS similarity,
      lp.teacher_verified,
      lp.times_referenced,
      lp.teacher_quality_rating,
      CASE WHEN query_text != '' THEN
        ts_rank_cd(lp.fts, plainto_tsquery('english', query_text))
      ELSE 0 END AS text_rank
    FROM lesson_profiles lp
    WHERE
      (filter_subject IS NULL OR lp.subject_area ILIKE '%' || filter_subject || '%')
      AND (filter_grade IS NULL OR lp.grade_level ILIKE '%' || filter_grade || '%')
      AND (filter_criteria IS NULL OR lp.criteria_covered && filter_criteria)
      AND (filter_approach IS NULL OR lp.pedagogical_approach ILIKE '%' || filter_approach || '%')
      AND (filter_teacher_id IS NULL OR lp.teacher_id = filter_teacher_id)
      AND (NOT only_verified OR lp.teacher_verified = true)
      AND lp.embedding IS NOT NULL
  )
  SELECT
    s.id, s.title, s.subject_area, s.grade_level,
    s.pedagogical_approach, s.complexity_level,
    s.criteria_covered, s.profile_data,
    s.similarity,
    -- Weighted score: similarity + text relevance + quality signals
    (0.5 * s.similarity)
    + (0.1 * LEAST(s.text_rank, 1.0))
    + (0.15 * CASE WHEN s.teacher_verified THEN 1.0 ELSE 0.3 END)
    + (0.15 * LEAST(s.times_referenced::float / 20.0, 1.0))
    + (0.1 * COALESCE(s.teacher_quality_rating::float / 5.0, 0.5))
    AS final_score
  FROM scored s
  WHERE s.similarity > 0.25
  ORDER BY final_score DESC
  LIMIT match_count;
$$;

-- ============================================================
-- 7. Helper RPC: increment times_referenced
-- ============================================================

CREATE OR REPLACE FUNCTION increment_profile_reference(profile_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE lesson_profiles
  SET times_referenced = times_referenced + 1,
      updated_at = now()
  WHERE id = profile_id;
$$;

-- ============================================================
-- 8. Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_lesson_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_profiles_updated_at
  BEFORE UPDATE ON lesson_profiles
  FOR EACH ROW EXECUTE FUNCTION update_lesson_profiles_updated_at();

-- ============================================================
-- 9. Add FK from knowledge_uploads to lesson_profiles
-- ============================================================

ALTER TABLE knowledge_uploads
  ADD CONSTRAINT knowledge_uploads_lesson_profile_fk
  FOREIGN KEY (lesson_profile_id) REFERENCES lesson_profiles(id) ON DELETE SET NULL;
