-- 010: Knowledge base for RAG-enhanced AI unit generation
-- Enables pgvector for embedding storage and similarity search

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Knowledge chunks table — stores embedded content from
-- uploaded lesson plans, created units, and activity templates
-- ============================================================

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  source_type TEXT NOT NULL CHECK (source_type IN ('uploaded_plan', 'created_unit', 'activity_template')),
  source_id TEXT,
  source_filename TEXT,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,
  context_preamble TEXT,

  -- Structured metadata for filtering
  criterion TEXT CHECK (criterion IN ('A', 'B', 'C', 'D')),
  page_id TEXT,
  grade_level TEXT,
  subject_area TEXT,
  topic TEXT,
  global_context TEXT,
  key_concept TEXT,
  content_type TEXT CHECK (content_type IN ('activity', 'instruction', 'assessment', 'vocabulary', 'overview', 'reflection')),

  -- Quality signals
  quality_score FLOAT DEFAULT 0.5,
  fork_count INT DEFAULT 0,
  teacher_rating FLOAT,
  times_retrieved INT DEFAULT 0,
  times_used INT DEFAULT 0,

  -- Embedding (1024-dim half-precision vector)
  embedding halfvec(1024),

  -- Full-text search column
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

  -- Visibility
  is_public BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast approximate nearest-neighbour search
CREATE INDEX knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING hnsw (embedding halfvec_cosine_ops);

-- Full-text search index (BM25 component of hybrid search)
CREATE INDEX knowledge_chunks_fts_idx
  ON knowledge_chunks
  USING gin (fts);

-- Filter indexes
CREATE INDEX knowledge_chunks_criterion_idx ON knowledge_chunks (criterion);
CREATE INDEX knowledge_chunks_grade_idx ON knowledge_chunks (grade_level);
CREATE INDEX knowledge_chunks_teacher_idx ON knowledge_chunks (teacher_id);
CREATE INDEX knowledge_chunks_source_idx ON knowledge_chunks (source_type, source_id);
CREATE INDEX knowledge_chunks_public_idx ON knowledge_chunks (is_public) WHERE is_public = true;

-- ============================================================
-- Hybrid search RPC — blends vector similarity + BM25 + quality
-- ============================================================

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding halfvec(1024),
  query_text TEXT DEFAULT '',
  match_count INT DEFAULT 10,
  similarity_weight FLOAT DEFAULT 0.7,
  quality_weight FLOAT DEFAULT 0.3,
  filter_criterion TEXT DEFAULT NULL,
  filter_grade TEXT DEFAULT NULL,
  filter_teacher_id UUID DEFAULT NULL,
  include_public BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  context_preamble TEXT,
  metadata JSONB,
  similarity FLOAT,
  quality_score FLOAT,
  final_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH scored AS (
    SELECT
      kc.id,
      kc.content,
      kc.context_preamble,
      jsonb_build_object(
        'source_type', kc.source_type,
        'source_filename', kc.source_filename,
        'criterion', kc.criterion,
        'page_id', kc.page_id,
        'grade_level', kc.grade_level,
        'subject_area', kc.subject_area,
        'topic', kc.topic,
        'global_context', kc.global_context,
        'content_type', kc.content_type,
        'fork_count', kc.fork_count,
        'teacher_rating', kc.teacher_rating
      ) AS metadata,
      1 - (kc.embedding <=> query_embedding) AS similarity,
      kc.quality_score,
      CASE WHEN query_text != '' THEN
        ts_rank_cd(kc.fts, plainto_tsquery('english', query_text))
      ELSE 0 END AS text_rank
    FROM knowledge_chunks kc
    WHERE
      (filter_criterion IS NULL OR kc.criterion = filter_criterion)
      AND (filter_grade IS NULL OR kc.grade_level = filter_grade)
      AND (
        (filter_teacher_id IS NOT NULL AND kc.teacher_id = filter_teacher_id)
        OR (include_public AND kc.is_public = true)
      )
      AND kc.embedding IS NOT NULL
  )
  SELECT
    s.id,
    s.content,
    s.context_preamble,
    s.metadata,
    s.similarity,
    s.quality_score,
    (similarity_weight * (0.8 * s.similarity + 0.2 * LEAST(s.text_rank, 1.0)))
    + (quality_weight * COALESCE(s.quality_score, 0.5)) AS final_score
  FROM scored s
  WHERE s.similarity > 0.3
  ORDER BY final_score DESC
  LIMIT match_count;
$$;

-- ============================================================
-- Upload tracking table
-- ============================================================

CREATE TABLE knowledge_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT,
  chunk_count INT DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX knowledge_uploads_teacher_idx ON knowledge_uploads (teacher_id);

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_uploads ENABLE ROW LEVEL SECURITY;

-- Teachers can read their own chunks + public chunks
CREATE POLICY "Teachers read own and public chunks"
  ON knowledge_chunks FOR SELECT
  USING (teacher_id = auth.uid() OR is_public = true);

-- Teachers can insert/update/delete their own chunks
CREATE POLICY "Teachers manage own chunks"
  ON knowledge_chunks FOR ALL
  USING (teacher_id = auth.uid());

-- Teachers manage their own uploads
CREATE POLICY "Teachers manage own uploads"
  ON knowledge_uploads FOR ALL
  USING (teacher_id = auth.uid());

-- Service role can do everything (for background processing)
CREATE POLICY "Service role full access chunks"
  ON knowledge_chunks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access uploads"
  ON knowledge_uploads FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Helper RPCs for quality signal tracking
-- ============================================================

CREATE OR REPLACE FUNCTION increment_chunk_retrieval(chunk_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE knowledge_chunks
  SET times_retrieved = times_retrieved + 1,
      updated_at = now()
  WHERE id = chunk_id;
$$;

CREATE OR REPLACE FUNCTION increment_chunk_usage(chunk_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE knowledge_chunks
  SET times_used = times_used + 1,
      quality_score = LEAST(1.0, quality_score * 0.7 + 0.8 * 0.3),
      updated_at = now()
  WHERE id = chunk_id;
$$;
