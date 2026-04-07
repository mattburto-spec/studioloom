-- =========================================================================
-- Migration 063: content_items + content_assets tables
-- Dimensions3 Phase B — OS Seam 3 (generic upload entity)
--
-- content_items = the OS's upload tracking table, StudioLoom-scoped for now.
-- activity_blocks.source_upload_id references content_items(id).
-- content_assets stores extracted media from uploaded documents (OS Seam 4).
-- =========================================================================

-- Content Items (uploaded documents)
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id),
  school_id UUID,                         -- Nullable until school entity exists
  module TEXT DEFAULT 'studioloom',        -- OS Seam 2: cross-app scoping

  -- Identity
  title TEXT,
  content_type TEXT NOT NULL DEFAULT 'unknown',  -- lesson_plan/scheme_of_work/rubric/resource/textbook_extract/worksheet/unknown
  subject TEXT,
  strand TEXT,                            -- Curriculum strand/topic area
  level TEXT,                             -- Grade/year level

  -- Ingestion state
  file_hash TEXT,                         -- SHA-256 for dedup (Stage I-0)
  storage_path TEXT,                      -- Supabase Storage path to original file
  mime_type TEXT,
  file_size_bytes BIGINT,
  processing_status TEXT DEFAULT 'pending',  -- pending/processing/completed/failed
  pass_results JSONB,                     -- Per-pass output stored for sandbox replay

  -- Extracted content
  raw_extracted_text TEXT,
  parsed_sections JSONB,                  -- Stage I-1 output
  classification JSONB,                   -- Stage I-2 (Pass A) output
  enrichment JSONB,                       -- Stage I-3 (Pass B) output

  -- Metadata
  blocks_extracted INT DEFAULT 0,         -- Count of activity_blocks created from this item
  copyright_flag TEXT DEFAULT 'unknown',  -- own/copyrighted/creative_commons/unknown

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_items_teacher ON content_items(teacher_id);
CREATE INDEX IF NOT EXISTS idx_content_items_hash ON content_items(file_hash);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(processing_status);
CREATE INDEX IF NOT EXISTS idx_content_items_module ON content_items(module);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(content_type);

-- Content Assets (extracted media from uploaded documents)
CREATE TABLE IF NOT EXISTS content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,               -- image/diagram/table/chart
  storage_path TEXT NOT NULL,             -- Supabase Storage path
  thumbnail_path TEXT,                    -- Auto-generated thumbnail
  mime_type TEXT,
  file_size_bytes BIGINT,
  extracted_text TEXT,                    -- OCR text if applicable
  page_number INT,                        -- Source page in document
  section_index INT,                      -- Which parsed section this belongs to
  ai_description TEXT,                    -- Optional: Pass B can describe what the image shows
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_assets_item ON content_assets(content_item_id);

-- RLS Policies
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;

-- Teachers can see their own content items
CREATE POLICY "content_items_select_own" ON content_items
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "content_items_insert_own" ON content_items
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "content_items_update_own" ON content_items
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "content_items_delete_own" ON content_items
  FOR DELETE USING (teacher_id = auth.uid());

-- Content assets inherit access from content_items
CREATE POLICY "content_assets_select" ON content_assets
  FOR SELECT USING (
    content_item_id IN (SELECT id FROM content_items WHERE teacher_id = auth.uid())
  );

CREATE POLICY "content_assets_insert" ON content_assets
  FOR INSERT WITH CHECK (
    content_item_id IN (SELECT id FROM content_items WHERE teacher_id = auth.uid())
  );

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_content_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW
  EXECUTE FUNCTION update_content_items_updated_at();
