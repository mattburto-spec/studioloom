-- 015: Activity Cards system
-- Database-backed activity library with rich metadata, AI modifiers,
-- usage tracking, and hybrid search (vector + FTS).

-- Ensure pgvector extension is available (may already exist from migration 010)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- activity_cards — stores all activity card definitions
-- ============================================================

CREATE TABLE activity_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  slug TEXT UNIQUE NOT NULL,                   -- e.g. "scamper", "six-thinking-hats"
  name TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'design-thinking', 'visible-thinking', 'evaluation',
    'brainstorming', 'analysis', 'skills'
  )),
  criteria TEXT[] DEFAULT '{}',               -- MYP criteria: {'A','B','C','D'}
  phases TEXT[] DEFAULT '{}',                 -- e.g. {'ideation','analysis'}
  thinking_type TEXT CHECK (thinking_type IN (
    'creative', 'critical', 'analytical', 'metacognitive'
  )),

  -- Logistics
  duration_minutes INT,                       -- actual minutes (not enum buckets)
  group_size TEXT CHECK (group_size IN (
    'individual', 'pairs', 'small-group', 'whole-class', 'flexible'
  )),
  materials TEXT[] DEFAULT '{}',              -- e.g. {'paper','scissors','glue'}
  tools TEXT[] DEFAULT '{}',                  -- e.g. {'TinkerCAD','Canva'}
  resources_needed TEXT,                      -- free-text preparation notes
  teacher_notes TEXT,                         -- tips for running this activity

  -- Content
  template JSONB NOT NULL DEFAULT '{}',       -- { sections, vocabTerms?, reflection? }
  ai_hints JSONB NOT NULL DEFAULT '{}',       -- { whenToUse, topicAdaptation, modifierAxes[] }

  -- Curriculum support
  curriculum_frameworks TEXT[] DEFAULT '{IB_MYP}',

  -- Provenance
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN (
    'system', 'teacher', 'community', 'ai_generated'
  )),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_card_id UUID REFERENCES activity_cards(id) ON DELETE SET NULL,

  -- Quality signals
  times_used INT DEFAULT 0,
  avg_edit_distance FLOAT,

  -- Search: embedding + full-text
  -- Use vector (not halfvec) for broader pgvector version compatibility
  embedding vector(1024),
  fts tsvector GENERATED ALWAYS AS (
    to_tsvector('english', name || ' ' || description)
  ) STORED,

  -- Visibility
  is_public BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for semantic search
CREATE INDEX activity_cards_embedding_idx
  ON activity_cards
  USING hnsw (embedding vector_cosine_ops);

-- Full-text search index
CREATE INDEX activity_cards_fts_idx
  ON activity_cards
  USING gin (fts);

-- Filter indexes
CREATE INDEX activity_cards_category_idx ON activity_cards (category);
CREATE INDEX activity_cards_criteria_idx ON activity_cards USING gin (criteria);
CREATE INDEX activity_cards_source_idx ON activity_cards (source);
CREATE INDEX activity_cards_thinking_type_idx ON activity_cards (thinking_type);
CREATE INDEX activity_cards_curriculum_idx ON activity_cards USING gin (curriculum_frameworks);
CREATE INDEX activity_cards_slug_idx ON activity_cards (slug);

-- ============================================================
-- activity_card_usage — tracks every card insertion
-- ============================================================

CREATE TABLE activity_card_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES activity_cards(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID,
  page_id TEXT,
  criterion TEXT CHECK (criterion IN ('A', 'B', 'C', 'D')),
  modifiers_applied JSONB,                    -- { axis_id: selected_value }
  custom_prompt TEXT,
  sections_before JSONB,                      -- original template sections
  sections_after JSONB,                       -- adapted sections after AI
  teacher_rating SMALLINT CHECK (teacher_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX activity_card_usage_card_idx ON activity_card_usage (card_id);
CREATE INDEX activity_card_usage_teacher_idx ON activity_card_usage (teacher_id);

-- ============================================================
-- Hybrid search RPC for activity cards
-- ============================================================

CREATE OR REPLACE FUNCTION match_activity_cards(
  query_embedding vector(1024),
  query_text TEXT DEFAULT '',
  match_count INT DEFAULT 20,
  filter_category TEXT DEFAULT NULL,
  filter_criterion TEXT DEFAULT NULL,
  filter_thinking_type TEXT DEFAULT NULL,
  filter_group_size TEXT DEFAULT NULL,
  filter_max_duration INT DEFAULT NULL,
  filter_source TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  criteria TEXT[],
  phases TEXT[],
  thinking_type TEXT,
  duration_minutes INT,
  group_size TEXT,
  materials TEXT[],
  tools TEXT[],
  resources_needed TEXT,
  teacher_notes TEXT,
  template JSONB,
  ai_hints JSONB,
  curriculum_frameworks TEXT[],
  source TEXT,
  times_used INT,
  is_public BOOLEAN,
  similarity FLOAT,
  final_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH scored AS (
    SELECT
      ac.*,
      1 - (ac.embedding <=> query_embedding) AS sim,
      CASE WHEN query_text != '' THEN
        ts_rank_cd(ac.fts, plainto_tsquery('english', query_text))
      ELSE 0 END AS text_rank
    FROM activity_cards ac
    WHERE
      ac.is_public = true
      AND ac.embedding IS NOT NULL
      AND (filter_category IS NULL OR ac.category = filter_category)
      AND (filter_criterion IS NULL OR filter_criterion = ANY(ac.criteria))
      AND (filter_thinking_type IS NULL OR ac.thinking_type = filter_thinking_type)
      AND (filter_group_size IS NULL OR ac.group_size = filter_group_size)
      AND (filter_max_duration IS NULL OR ac.duration_minutes <= filter_max_duration)
      AND (filter_source IS NULL OR ac.source = filter_source)
  )
  SELECT
    s.id, s.slug, s.name, s.description,
    s.category, s.criteria, s.phases, s.thinking_type,
    s.duration_minutes, s.group_size, s.materials, s.tools,
    s.resources_needed, s.teacher_notes,
    s.template, s.ai_hints, s.curriculum_frameworks,
    s.source, s.times_used, s.is_public,
    s.sim AS similarity,
    (0.6 * s.sim + 0.2 * LEAST(s.text_rank, 1.0) + 0.2 * LEAST(s.times_used::float / 100, 1.0)) AS final_score
  FROM scored s
  WHERE s.sim > 0.2
  ORDER BY final_score DESC
  LIMIT match_count;
$$;

-- ============================================================
-- Helper: increment usage count on a card
-- ============================================================

CREATE OR REPLACE FUNCTION increment_activity_card_usage(card_uuid UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE activity_cards
  SET times_used = times_used + 1,
      updated_at = now()
  WHERE id = card_uuid;
$$;

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE activity_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_card_usage ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read public cards
CREATE POLICY "Anyone can read public activity cards"
  ON activity_cards FOR SELECT
  USING (is_public = true);

-- Teachers can read their own private cards
CREATE POLICY "Teachers read own cards"
  ON activity_cards FOR SELECT
  USING (created_by = auth.uid());

-- Teachers can manage their own cards (not system cards)
CREATE POLICY "Teachers manage own cards"
  ON activity_cards FOR ALL
  USING (created_by = auth.uid() AND source != 'system');

-- Service role full access (for seeding + admin)
CREATE POLICY "Service role full access activity cards"
  ON activity_cards FOR ALL
  USING (auth.role() = 'service_role');

-- Usage tracking: teachers manage their own records
CREATE POLICY "Teachers manage own usage records"
  ON activity_card_usage FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "Service role full access usage"
  ON activity_card_usage FOR ALL
  USING (auth.role() = 'service_role');
