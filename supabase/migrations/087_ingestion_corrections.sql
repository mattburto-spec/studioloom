-- Migration 087: Ingestion corrections for progressive learning
-- Stores user corrections to Pass A classification so future imports
-- can inject them as few-shot examples. Part of the ingestion checkpoint system.

CREATE TABLE IF NOT EXISTS ingestion_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  -- What the AI produced
  ai_document_type TEXT,
  ai_subject TEXT,
  ai_grade_level TEXT,
  ai_section_count INT,
  -- What the user corrected it to (NULL = AI was correct for this field)
  corrected_document_type TEXT,
  corrected_subject TEXT,
  corrected_grade_level TEXT,
  corrected_section_count INT,
  -- Free-text note from the user (e.g., "3 lessons per week, not more")
  correction_note TEXT,
  -- Context for few-shot matching
  document_title TEXT,
  file_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying recent corrections by teacher
CREATE INDEX idx_ingestion_corrections_teacher
  ON ingestion_corrections(teacher_id, created_at DESC);

-- RLS: teachers see only their own corrections
ALTER TABLE ingestion_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers read own corrections"
  ON ingestion_corrections FOR SELECT
  USING (teacher_id = auth.uid());

-- Service role can insert/read all (API routes use admin client)
CREATE POLICY "Service role full access"
  ON ingestion_corrections FOR ALL
  USING (auth.role() = 'service_role');
