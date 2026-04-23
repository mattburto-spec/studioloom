-- =====================================================================
-- 105_skills_library_schema.sql
-- Skills Library Phase S1 — core schema
--
-- Creates the five tables that form the Skills Library foundation:
--   - skill_categories: 8-item lookup (neutral criterion taxonomy)
--   - skill_cards:      canonical content entity
--   - skill_card_tags:  simple many-to-many tag list
--   - skill_prerequisites: directed edges for progression
--   - skill_external_links: resource references (videos, PDFs, docs)
--
-- Seed data: 8 neutral categories from docs/specs/neutral-criterion-taxonomy.md.
-- Baseline RLS: authenticated reads open to all (content is library-wide);
-- writes restricted to service role for S1 (tightened in S2 when authoring
-- UI lands and we know the access patterns).
-- =====================================================================

-- ---------------------------------------------------------------------
-- skill_categories — 8 neutral buckets, framework-agnostic
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_categories (
  id            text PRIMARY KEY,
  label         text NOT NULL,
  description   text NOT NULL,
  display_order int  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO skill_categories (id, label, description, display_order) VALUES
  ('researching',   'Researching',
   'Gathering information: interviews, surveys, source analysis, existing product analysis, literature review, field observation',
   10),
  ('analysing',     'Analysing',
   'Making sense of gathered information: identifying patterns, comparing/contrasting, drawing conclusions from data, needs assessment, root cause analysis',
   20),
  ('designing',     'Designing',
   'Generating and developing solutions: ideation, specification writing, concept development, prototyping plans, selecting and justifying approaches',
   30),
  ('creating',      'Creating',
   'Making/building/producing: physical prototyping, digital production, implementing plans, fabrication, coding, hands-on construction',
   40),
  ('evaluating',    'Evaluating',
   'Testing and judging quality: testing against criteria, peer review, self-assessment, fitness-for-purpose analysis, impact measurement',
   50),
  ('reflecting',    'Reflecting',
   'Metacognitive review: process reflection, learning transfer, growth identification, what-went-well/even-better-if, personal development',
   60),
  ('communicating', 'Communicating',
   'Presenting and sharing: oral presentation, written reports, visual documentation, portfolio assembly, audience-appropriate communication, demonstration',
   70),
  ('planning',      'Planning',
   'Organising and managing: timeline creation, resource identification, task sequencing, goal setting, risk assessment, project management',
   80)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- skill_cards — canonical content entity
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_cards (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text UNIQUE NOT NULL,                             -- URL-safe identifier: 'ideation-thumbnails'
  title                 text NOT NULL,
  summary               text,                                             -- 1-2 sentence overview
  category_id           text REFERENCES skill_categories(id) ON DELETE RESTRICT,
  difficulty            text CHECK (difficulty IN ('foundational','intermediate','advanced')),
  body                  jsonb NOT NULL DEFAULT '[]'::jsonb,               -- structured blocks: [{type:'prose',text:...},{type:'video',url:...},...]
  estimated_min         int,                                              -- rough time estimate for student to complete; surfaced as hint
  is_built_in           boolean NOT NULL DEFAULT false,                   -- platform vs teacher authored
  created_by_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published          boolean NOT NULL DEFAULT false,                   -- draft vs live
  schema_version        int NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skill_cards_category_idx    ON skill_cards(category_id);
CREATE INDEX IF NOT EXISTS skill_cards_published_idx   ON skill_cards(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS skill_cards_slug_idx        ON skill_cards(slug);
CREATE INDEX IF NOT EXISTS skill_cards_author_idx      ON skill_cards(created_by_teacher_id) WHERE created_by_teacher_id IS NOT NULL;

-- Auto-bump updated_at on row update
CREATE OR REPLACE FUNCTION skill_cards_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS skill_cards_updated_at ON skill_cards;
CREATE TRIGGER skill_cards_updated_at
  BEFORE UPDATE ON skill_cards
  FOR EACH ROW EXECUTE FUNCTION skill_cards_touch_updated_at();

-- ---------------------------------------------------------------------
-- skill_card_tags — many-to-many tag list for filtering
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_card_tags (
  skill_id  uuid NOT NULL REFERENCES skill_cards(id) ON DELETE CASCADE,
  tag       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill_id, tag)
);

CREATE INDEX IF NOT EXISTS skill_card_tags_tag_idx ON skill_card_tags(tag);

-- ---------------------------------------------------------------------
-- skill_prerequisites — directed edges (A requires B)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_prerequisites (
  skill_id        uuid NOT NULL REFERENCES skill_cards(id) ON DELETE CASCADE,
  prerequisite_id uuid NOT NULL REFERENCES skill_cards(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill_id, prerequisite_id),
  CHECK (skill_id <> prerequisite_id)
);

CREATE INDEX IF NOT EXISTS skill_prerequisites_prereq_idx ON skill_prerequisites(prerequisite_id);

-- ---------------------------------------------------------------------
-- skill_external_links — video / PDF / doc references attached to a card
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_external_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id        uuid NOT NULL REFERENCES skill_cards(id) ON DELETE CASCADE,
  url             text NOT NULL,
  title           text,
  kind            text CHECK (kind IN ('video','pdf','doc','website','other')),
  display_order   int NOT NULL DEFAULT 0,
  -- Nightly link-check support (spec calls this out as Day-1 must-have):
  last_checked_at timestamptz,                                   -- null = never checked
  status          text CHECK (status IN ('ok','broken','redirect','timeout','unchecked')) DEFAULT 'unchecked',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index supports the cron job's stale-first scan:
CREATE INDEX IF NOT EXISTS skill_external_links_stale_idx
  ON skill_external_links (last_checked_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS skill_external_links_skill_idx ON skill_external_links(skill_id);

-- =====================================================================
-- RLS — baseline for S1
-- =====================================================================
-- S1 opens authenticated reads on published cards + all support tables.
-- Writes are service-role-only for S1 (authoring UI in S2 will introduce
-- teacher-write policies). Seeds go in via service role in this migration.
-- =====================================================================

ALTER TABLE skill_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_card_tags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_prerequisites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_external_links   ENABLE ROW LEVEL SECURITY;

-- Categories: everyone authenticated can read
DROP POLICY IF EXISTS skill_categories_read_all ON skill_categories;
CREATE POLICY skill_categories_read_all ON skill_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- Cards: authenticated reads on published rows; drafts only visible to
-- the author (via created_by_teacher_id) or service role
DROP POLICY IF EXISTS skill_cards_read_published ON skill_cards;
CREATE POLICY skill_cards_read_published ON skill_cards
  FOR SELECT USING (
    is_published = true
    OR auth.uid() = created_by_teacher_id
  );

-- Tags, prereqs, links: readable when you can read the parent card
DROP POLICY IF EXISTS skill_card_tags_read ON skill_card_tags;
CREATE POLICY skill_card_tags_read ON skill_card_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_card_tags.skill_id
        AND (c.is_published = true OR auth.uid() = c.created_by_teacher_id)
    )
  );

DROP POLICY IF EXISTS skill_prerequisites_read ON skill_prerequisites;
CREATE POLICY skill_prerequisites_read ON skill_prerequisites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_prerequisites.skill_id
        AND (c.is_published = true OR auth.uid() = c.created_by_teacher_id)
    )
  );

DROP POLICY IF EXISTS skill_external_links_read ON skill_external_links;
CREATE POLICY skill_external_links_read ON skill_external_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_external_links.skill_id
        AND (c.is_published = true OR auth.uid() = c.created_by_teacher_id)
    )
  );

-- No INSERT/UPDATE/DELETE policies in S1 — service role handles authoring
-- until S2 introduces teacher-write policies tied to auth.uid().

COMMENT ON TABLE skill_categories     IS 'Skills Library S1: 8 neutral categories, framework-agnostic lookup.';
COMMENT ON TABLE skill_cards          IS 'Skills Library S1: canonical content entity. Body is structured-block JSONB.';
COMMENT ON TABLE skill_card_tags      IS 'Skills Library S1: many-to-many tag list for filtering.';
COMMENT ON TABLE skill_prerequisites  IS 'Skills Library S1: directed graph — skill A requires prerequisite B.';
COMMENT ON TABLE skill_external_links IS 'Skills Library S1: video/PDF/doc references attached to a card.';
