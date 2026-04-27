-- =====================================================================
-- 110_skills_library_world_class_schema.sql
-- Skills Library — schema upgrade to host the v1 catalogue of 60 cards.
--
-- Why: the catalogue in docs/projects/skills-library-catalogue-v1.md uses
-- fields that the S1 schema doesn't have. This migration adds them all,
-- renames difficulty → tier with DofE vocabulary, and creates the 10
-- subject-area domains as a sibling to the 8 cognitive-action categories.
--
-- Changes:
--   1. New table `skill_domains` — 10 subject-area groupings (DM, VC, CP,
--      CT, LI, PM, FE, RI, DL, SM). Orthogonal to skill_categories.
--   2. skill_cards.difficulty → skill_cards.tier (bronze/silver/gold,
--      DofE vocabulary per research-brief principle #3). Data migration
--      maps foundational→bronze, intermediate→silver, advanced→gold.
--   3. skill_cards adds: domain_id (FK), age_min, age_max,
--      framework_anchors (JSONB), demo_of_competency, learning_outcomes
--      (JSONB), applied_in (JSONB), card_type (lesson|routine),
--      author_name.
--
-- Backfill:
--   - Existing 3 built-in seeds (migration 108) get tier set from their
--     old difficulty, and domain_id='design-making' (all 3 are DM cards).
--   - All new JSONB columns default to empty array — cards can be
--     incrementally fleshed out later.
--
-- Coordinated code change: app code that referenced skill_cards.difficulty
-- moves to skill_cards.tier in the same PR. Do not apply this migration
-- without the code change already deployed or the app will throw.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. skill_domains — 10 subject-area domains
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_domains (
  id            text PRIMARY KEY,              -- 'design-making'
  short_code    text NOT NULL UNIQUE,          -- 'DM' — used in catalogue card IDs (DM-B1 etc.)
  label         text NOT NULL,                 -- 'Design & Making'
  description   text NOT NULL,
  display_order int  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO skill_domains (id, short_code, label, description, display_order) VALUES
  ('design-making',             'DM',
   'Design & Making',
   'The workshop and technical-craft spine. Students produce physical or digital artefacts and learn the conventions that make making communicable to others.',
   10),
  ('visual-communication',      'VC',
   'Visual Communication',
   'How to make ideas visible. Diagramming, layout, and the technical drawing conventions that separate doodle from document.',
   20),
  ('communication-presenting',  'CP',
   'Communication & Presenting',
   'Speaking, listening, writing — the tools for making internal thinking reach other people.',
   30),
  ('collaboration-teamwork',    'CT',
   'Collaboration & Teamwork',
   'Two or more people, one outcome. Pair work, team dynamics, and honest credit.',
   40),
  ('leadership-influence',      'LI',
   'Leadership & Influence',
   'The moves a young person makes to guide a group or change someone''s mind — ethically, without authority.',
   50),
  ('project-management',        'PM',
   'Project Management',
   'Breaking work down, planning time, and finishing. The invisible skill that separates a finished project from a forever-prototype.',
   60),
  ('finance-enterprise',        'FE',
   'Finance & Enterprise',
   'Money-literacy for young makers — budgets, pricing, value. Keeps the focus on making-related money decisions.',
   70),
  ('research-inquiry',          'RI',
   'Research & Inquiry',
   'Asking questions, finding out, and not being fooled. The backbone of any Discovery or Service unit.',
   80),
  ('digital-literacy',          'DL',
   'Digital Literacy & Citizenship',
   'Using digital tools well, safely, and ethically. Includes AI, privacy, sourcing, and online conduct.',
   90),
  ('self-management-resilience','SM',
   'Self-Management & Resilience',
   'Managing yourself — time, focus, stress, growth — so the rest of your work is possible. The highest-leverage domain for long-term outcomes.',
   100)
ON CONFLICT (id) DO NOTHING;

-- RLS — same pattern as skill_categories (authenticated read, service-role write)
ALTER TABLE skill_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skill_domains_read_all ON skill_domains;
CREATE POLICY skill_domains_read_all ON skill_domains
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE skill_domains IS
  'Skills Library subject-area domains (10 from catalogue v1). Orthogonal to skill_categories (8 cognitive actions) — every card carries both.';

-- ---------------------------------------------------------------------
-- 2. skill_cards — rename difficulty → tier
-- ---------------------------------------------------------------------
-- The old difficulty column had an anonymous CHECK constraint. Simplest
-- path: add tier column, backfill from difficulty, drop difficulty.

ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS tier text
  CHECK (tier IN ('bronze','silver','gold'));

UPDATE skill_cards
SET tier = CASE difficulty
  WHEN 'foundational' THEN 'bronze'
  WHEN 'intermediate' THEN 'silver'
  WHEN 'advanced'     THEN 'gold'
  ELSE NULL
END
WHERE tier IS NULL;

ALTER TABLE skill_cards DROP COLUMN IF EXISTS difficulty;

-- ---------------------------------------------------------------------
-- 3. skill_cards — add domain FK
-- ---------------------------------------------------------------------
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS domain_id text
  REFERENCES skill_domains(id) ON DELETE RESTRICT;

-- Backfill existing built-in seeds. The 3 seeds from migration 108 are
-- all Design & Making cards (ideation thumbnails, 3D printing basics,
-- 3D printing troubleshooting).
UPDATE skill_cards
SET domain_id = 'design-making'
WHERE domain_id IS NULL
  AND is_built_in = true
  AND slug IN ('ideation-thumbnails', '3d-printing-basic-setup', '3d-printing-troubleshooting');

-- ---------------------------------------------------------------------
-- 4. skill_cards — age band
-- ---------------------------------------------------------------------
-- Integers rather than an enum band so queries like "cards for a 14yo"
-- are clean: WHERE age_min <= 14 AND age_max >= 14.
ALTER TABLE skill_cards ADD COLUMN IF NOT EXISTS age_min int;
ALTER TABLE skill_cards ADD COLUMN IF NOT EXISTS age_max int;

-- Sanity: age_min <= age_max when both set
ALTER TABLE skill_cards
  ADD CONSTRAINT skill_cards_age_band_sane
  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max);

-- ---------------------------------------------------------------------
-- 5. skill_cards — framework anchors, demo, outcomes, applied_in
-- ---------------------------------------------------------------------
-- framework_anchors: array of {framework: 'ATL'|'CASEL'|'WEF'|'StudioHabits',
--                              label: 'Self-Management' etc.}
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS framework_anchors jsonb NOT NULL DEFAULT '[]'::jsonb;

-- demo_of_competency: the Digital Promise "evidence criterion" — single
-- sentence using a controlled verb (show / demonstrate / produce / explain
-- / argue / identify / compare / sketch / make / plan / deliver).
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS demo_of_competency text;

-- learning_outcomes: array of strings ("Student can ...")
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS learning_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- applied_in: array of context labels ("Fabrication Pipeline", "Lesson
-- activity block — prototyping", "Open Studio capability-gap" etc.).
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS applied_in jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 6. skill_cards — card_type (lesson vs routine)
-- ---------------------------------------------------------------------
-- 'lesson'  = standard mixed-blocks body with optional quiz gate.
-- 'routine' = Project Zero-style thinking routine (a named 3–6 step
--             prompt run against the student's own work). Different
--             renderer path + per-artefact demo semantics in later work.
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS card_type text NOT NULL DEFAULT 'lesson'
  CHECK (card_type IN ('lesson','routine'));

-- ---------------------------------------------------------------------
-- 7. skill_cards — author byline
-- ---------------------------------------------------------------------
-- The Scouts-pamphlet model: every card has a named human responsible
-- for its content. Separate from created_by_teacher_id because a card
-- may be ghost-authored (e.g. a teacher seeds content but credits a
-- colleague), or inherited from a fork with credit preserved.
ALTER TABLE skill_cards ADD COLUMN IF NOT EXISTS author_name text;

-- ---------------------------------------------------------------------
-- 8. Indexes for common filter queries
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS skill_cards_tier_idx       ON skill_cards(tier);
CREATE INDEX IF NOT EXISTS skill_cards_domain_idx     ON skill_cards(domain_id);
CREATE INDEX IF NOT EXISTS skill_cards_card_type_idx  ON skill_cards(card_type);
CREATE INDEX IF NOT EXISTS skill_cards_age_band_idx   ON skill_cards(age_min, age_max);

-- Drop the old difficulty index (it referenced the dropped column; PG
-- usually cleans this up automatically on DROP COLUMN but be explicit).
DROP INDEX IF EXISTS skill_cards_difficulty_idx;

-- ---------------------------------------------------------------------
-- 9. Column comments
-- ---------------------------------------------------------------------
COMMENT ON COLUMN skill_cards.tier IS
  'DofE progression tier. bronze = foundational (ages 11–13 typical), silver = applied (13–15), gold = high-leverage transferable (15–18). Replaced the previous difficulty column in migration 110.';
COMMENT ON COLUMN skill_cards.domain_id IS
  'Subject-area domain (10 catalogue groupings). Orthogonal to category_id (8 cognitive actions). Both expected on authored cards.';
COMMENT ON COLUMN skill_cards.age_min IS
  'Typical lower age bound. Soft hint — UI may warn younger students but not block.';
COMMENT ON COLUMN skill_cards.age_max IS
  'Typical upper age bound. Same soft-hint semantics as age_min.';
COMMENT ON COLUMN skill_cards.framework_anchors IS
  'JSONB array of {framework, label}. framework ∈ ATL / CASEL / WEF / StudioHabits. Defensibility anchor per research-brief principle #7.';
COMMENT ON COLUMN skill_cards.demo_of_competency IS
  'Digital Promise "evidence criterion" — one sentence using a controlled verb (show / demonstrate / produce / explain / argue / identify / compare / sketch / make / plan / deliver). Banned verbs: understand, know, appreciate.';
COMMENT ON COLUMN skill_cards.learning_outcomes IS
  'JSONB array of strings, each a "Student can…" bullet. Functions as the rubric rendered at card-intake time per Digital Promise "rubric before attempt" principle.';
COMMENT ON COLUMN skill_cards.applied_in IS
  'JSONB array of context strings (lesson activity blocks / fabrication pipeline / Open Studio / class gallery / safety badges). Drives pull-at-moment-of-need surfacing.';
COMMENT ON COLUMN skill_cards.card_type IS
  'lesson = standard mixed-blocks with optional quiz. routine = Project Zero thinking routine (a named 3–6 step prompt run against student work, repeatable per-artefact).';
COMMENT ON COLUMN skill_cards.author_name IS
  'Human byline — the Scouts pamphlet-author model. Separate from created_by_teacher_id because the DB owner may not be the content author.';
