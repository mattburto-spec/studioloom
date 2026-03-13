-- 020: Add source_category to knowledge_uploads
-- Enables textbook vs lesson plan distinction for future copyright-safe chunking

ALTER TABLE knowledge_uploads
  ADD COLUMN source_category TEXT NOT NULL DEFAULT 'lesson_plan';

COMMENT ON COLUMN knowledge_uploads.source_category IS
  'Categorizes the upload: lesson_plan, textbook, resource. Controls future chunking/analysis behavior.';

-- Index for filtering by category
CREATE INDEX idx_knowledge_uploads_source_category ON knowledge_uploads(source_category);
