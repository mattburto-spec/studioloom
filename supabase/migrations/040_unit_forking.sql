-- ═══════════════════════════════════════════════════════════════
-- Migration 040: Unit Forking — Class-Local Content
-- ═══════════════════════════════════════════════════════════════
-- Enables per-class content editing via copy-on-write forking.
-- When a teacher edits a unit in a class context, the content is
-- deep-copied into class_units.content_data. Subsequent edits
-- modify the class-local copy, leaving the master unit untouched.
--
-- Resolution chain: class_units.content_data (if not NULL) → units.content_data
-- Same inheritance pattern as NM config.
--
-- Additive-only migration — safe to revert code without rollback.

-- ── Class-local content fork columns ──

-- The full unit content JSONB, forked from master on first edit
ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS content_data JSONB DEFAULT NULL;

-- When the fork happened
ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS forked_at TIMESTAMPTZ DEFAULT NULL;

-- Which master version was the source of the fork
ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS forked_from_version INTEGER DEFAULT NULL;

-- ── Master unit version tracking ──

-- Array of version snapshots: [{ version, label, created_at, source_class_id, content_hash }]
-- Full content_data is NOT stored in versions array (too large) — stored separately
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS versions JSONB DEFAULT '[]';

-- Current version number (increments when teacher saves a new version)
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

-- ── Version content storage ──
-- Separate table for version snapshots to keep units.versions lightweight
CREATE TABLE IF NOT EXISTS unit_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label TEXT,
  content_data JSONB NOT NULL,
  source_class_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, version_number)
);

-- RLS for unit_versions
ALTER TABLE unit_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read own unit versions" ON unit_versions
  FOR SELECT USING (
    unit_id IN (SELECT id FROM units WHERE author_teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can insert own unit versions" ON unit_versions
  FOR INSERT WITH CHECK (
    unit_id IN (SELECT id FROM units WHERE author_teacher_id = auth.uid())
  );

-- Index for version lookups
CREATE INDEX IF NOT EXISTS idx_unit_versions_unit
  ON unit_versions(unit_id, version_number);
