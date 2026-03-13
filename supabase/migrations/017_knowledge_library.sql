-- 017: Knowledge Library
-- Evolves the "dump-and-forget" RAG knowledge base into a browsable,
-- teacher-curated resource library with curriculum cross-mapping.
--
-- New tables:
--   knowledge_items          — browsable resource entities (tutorials, choice boards, etc.)
--   knowledge_item_curricula — maps items to multiple curriculum frameworks
--   knowledge_item_links     — links items to unit pages for student discovery
--
-- Alters:
--   knowledge_chunks         — adds item_id FK + expands source_type CHECK

-- ============================================================
-- knowledge_items — the core browsable resource entity
-- ============================================================

CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',

  -- Classification
  item_type TEXT NOT NULL CHECK (item_type IN (
    'tutorial', 'choice-board', 'reference', 'skill-guide',
    'textbook-section', 'lesson-resource',
    'image', 'video', 'audio', 'other'
  )),
  tags TEXT[] DEFAULT '{}',

  -- Structured content (shape depends on item_type)
  content JSONB NOT NULL DEFAULT '{}',

  -- Provenance
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN (
    'manual', 'upload', 'unit', 'ai_generated'
  )),
  source_upload_id UUID,  -- soft ref to knowledge_uploads (may not exist yet)
  source_unit_id UUID,   -- soft ref to units

  -- Ownership
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Counters (denormalized for fast reads)
  counters JSONB NOT NULL DEFAULT '{"times_linked":0,"times_viewed":0,"avg_rating":null}',

  -- Media
  thumbnail_url TEXT,
  media_url TEXT,        -- primary media URL (for image/video/audio types)

  -- Search
  embedding halfvec(1024),  -- Voyage AI, matches knowledge_chunks
  fts tsvector,             -- populated by trigger (array_to_string is not immutable)

  -- Visibility
  is_public BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to keep fts column in sync
CREATE OR REPLACE FUNCTION knowledge_items_fts_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fts := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_items_fts_update
  BEFORE INSERT OR UPDATE OF title, description, tags
  ON knowledge_items
  FOR EACH ROW
  EXECUTE FUNCTION knowledge_items_fts_trigger();

-- Slug uniqueness per teacher (different teachers can reuse slugs)
CREATE UNIQUE INDEX knowledge_items_teacher_slug_idx
  ON knowledge_items (teacher_id, slug);

-- HNSW for semantic search
CREATE INDEX knowledge_items_embedding_idx
  ON knowledge_items
  USING hnsw (embedding halfvec_cosine_ops);

-- Full-text search
CREATE INDEX knowledge_items_fts_idx
  ON knowledge_items
  USING gin (fts);

-- Filter indexes
CREATE INDEX knowledge_items_teacher_idx ON knowledge_items (teacher_id);
CREATE INDEX knowledge_items_type_idx ON knowledge_items (item_type);
CREATE INDEX knowledge_items_tags_idx ON knowledge_items USING gin (tags);
CREATE INDEX knowledge_items_public_idx ON knowledge_items (is_public) WHERE is_public = true;
CREATE INDEX knowledge_items_not_archived_idx ON knowledge_items (is_archived) WHERE is_archived = false;
CREATE INDEX knowledge_items_updated_idx ON knowledge_items (updated_at DESC);

-- ============================================================
-- knowledge_item_curricula — multi-framework mapping
-- ============================================================

CREATE TABLE knowledge_item_curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES knowledge_items(id) ON DELETE CASCADE NOT NULL,
  framework TEXT NOT NULL,              -- e.g. 'IB_MYP', 'GCSE_DT', 'ACARA_DT'
  criteria TEXT[] DEFAULT '{}',         -- framework-specific: {'C'} for MYP, {'AO3'} for GCSE
  strand TEXT,                          -- e.g. 'Creating the Solution', 'Manufacturing'
  topic TEXT,                           -- e.g. 'Laser Cutting'
  year_group TEXT,                      -- e.g. 'Year 9', 'MYP4'
  textbook_ref TEXT,                    -- e.g. 'Chapter 5, p.102-115'
  UNIQUE (item_id, framework)
);

CREATE INDEX knowledge_item_curricula_item_idx ON knowledge_item_curricula (item_id);
CREATE INDEX knowledge_item_curricula_framework_idx ON knowledge_item_curricula (framework);

-- ============================================================
-- knowledge_item_links — links items to unit pages
-- ============================================================

CREATE TABLE knowledge_item_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES knowledge_items(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID NOT NULL,                -- soft ref to units
  page_id TEXT NOT NULL,                -- e.g. 'A1', 'B3', or nanoid
  link_type TEXT NOT NULL DEFAULT 'reference' CHECK (link_type IN (
    'reference', 'activity', 'resource', 'extension'
  )),
  display_mode TEXT NOT NULL DEFAULT 'sidebar' CHECK (display_mode IN (
    'sidebar', 'inline', 'choice-board'
  )),
  sort_order INT DEFAULT 0,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (item_id, unit_id, page_id)
);

CREATE INDEX knowledge_item_links_unit_page_idx ON knowledge_item_links (unit_id, page_id);
CREATE INDEX knowledge_item_links_item_idx ON knowledge_item_links (item_id);

-- ============================================================
-- ALTER knowledge_chunks — link chunks to parent knowledge items
-- Only runs if knowledge_chunks exists (migration 010 applied)
-- ============================================================

DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_chunks'
  ) THEN
    -- Add item_id column
    ALTER TABLE knowledge_chunks
      ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES knowledge_items(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS knowledge_chunks_item_idx
      ON knowledge_chunks (item_id)
      WHERE item_id IS NOT NULL;

    -- Expand source_type CHECK to include 'knowledge_item'
    SELECT conname INTO _constraint_name
    FROM pg_constraint
    WHERE conrelid = 'knowledge_chunks'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%source_type%';

    IF _constraint_name IS NOT NULL THEN
      EXECUTE 'ALTER TABLE knowledge_chunks DROP CONSTRAINT ' || quote_ident(_constraint_name);
    END IF;

    ALTER TABLE knowledge_chunks
      ADD CONSTRAINT knowledge_chunks_source_type_check
      CHECK (source_type IN ('uploaded_plan', 'created_unit', 'activity_template', 'knowledge_item'));

    RAISE NOTICE 'knowledge_chunks table altered successfully';
  ELSE
    RAISE NOTICE 'knowledge_chunks table not found — skipping ALTER (apply migration 010 first)';
  END IF;
END $$;

-- ============================================================
-- Hybrid search RPC for knowledge items
-- ============================================================

CREATE OR REPLACE FUNCTION match_knowledge_items(
  query_embedding halfvec(1024),
  query_text TEXT DEFAULT '',
  match_count INT DEFAULT 20,
  filter_type TEXT DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL,
  filter_framework TEXT DEFAULT NULL,
  filter_teacher_id UUID DEFAULT NULL,
  include_public BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  description TEXT,
  item_type TEXT,
  tags TEXT[],
  content JSONB,
  source_type TEXT,
  teacher_id UUID,
  counters JSONB,
  thumbnail_url TEXT,
  media_url TEXT,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT,
  final_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH scored AS (
    SELECT
      ki.*,
      1 - (ki.embedding <=> query_embedding) AS sim,
      CASE WHEN query_text != '' THEN
        ts_rank_cd(ki.fts, plainto_tsquery('english', query_text))
      ELSE 0 END AS text_rank
    FROM knowledge_items ki
    WHERE
      ki.is_archived = false
      AND ki.embedding IS NOT NULL
      AND (filter_type IS NULL OR ki.item_type = filter_type)
      AND (filter_tags IS NULL OR ki.tags @> filter_tags)
      AND (
        (filter_teacher_id IS NOT NULL AND ki.teacher_id = filter_teacher_id)
        OR (include_public AND ki.is_public = true)
      )
      AND (filter_framework IS NULL OR EXISTS (
        SELECT 1 FROM knowledge_item_curricula kic
        WHERE kic.item_id = ki.id AND kic.framework = filter_framework
      ))
  )
  SELECT
    s.id, s.title, s.slug, s.description,
    s.item_type, s.tags, s.content, s.source_type,
    s.teacher_id, s.counters,
    s.thumbnail_url, s.media_url,
    s.is_public, s.created_at, s.updated_at,
    s.sim AS similarity,
    (
      0.6 * s.sim
      + 0.2 * LEAST(s.text_rank, 1.0)
      + 0.1 * LEAST(COALESCE((s.counters->>'times_linked')::float, 0) / 50.0, 1.0)
      + 0.1 * LEAST(COALESCE((s.counters->>'avg_rating')::float, 0) / 5.0, 1.0)
    ) AS final_score
  FROM scored s
  WHERE s.sim > 0.25
  ORDER BY final_score DESC
  LIMIT match_count;
$$;

-- ============================================================
-- Helper: increment item view count
-- ============================================================

CREATE OR REPLACE FUNCTION increment_item_view(item_uuid UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE knowledge_items
  SET counters = jsonb_set(
    counters,
    '{times_viewed}',
    to_jsonb(COALESCE((counters->>'times_viewed')::int, 0) + 1)
  ),
  updated_at = now()
  WHERE id = item_uuid;
$$;

-- ============================================================
-- Helper: increment item link count
-- ============================================================

CREATE OR REPLACE FUNCTION increment_item_link(item_uuid UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE knowledge_items
  SET counters = jsonb_set(
    counters,
    '{times_linked}',
    to_jsonb(COALESCE((counters->>'times_linked')::int, 0) + 1)
  ),
  updated_at = now()
  WHERE id = item_uuid;
$$;

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_item_curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_item_links ENABLE ROW LEVEL SECURITY;

-- knowledge_items: teachers see own + public
CREATE POLICY "Teachers read own items"
  ON knowledge_items FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Anyone reads public items"
  ON knowledge_items FOR SELECT
  USING (is_public = true);

CREATE POLICY "Teachers manage own items"
  ON knowledge_items FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "Service role full access items"
  ON knowledge_items FOR ALL
  USING (auth.role() = 'service_role');

-- knowledge_item_curricula: follows parent item
CREATE POLICY "Curricula follow item read access"
  ON knowledge_item_curricula FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM knowledge_items ki
    WHERE ki.id = item_id
    AND (ki.teacher_id = auth.uid() OR ki.is_public = true)
  ));

CREATE POLICY "Teachers manage own item curricula"
  ON knowledge_item_curricula FOR ALL
  USING (EXISTS (
    SELECT 1 FROM knowledge_items ki
    WHERE ki.id = item_id AND ki.teacher_id = auth.uid()
  ));

CREATE POLICY "Service role full access curricula"
  ON knowledge_item_curricula FOR ALL
  USING (auth.role() = 'service_role');

-- knowledge_item_links: teacher-scoped
CREATE POLICY "Teachers read own links"
  ON knowledge_item_links FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers manage own links"
  ON knowledge_item_links FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "Service role full access links"
  ON knowledge_item_links FOR ALL
  USING (auth.role() = 'service_role');
