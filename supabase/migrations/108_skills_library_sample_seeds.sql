-- =====================================================================
-- 108_skills_library_sample_seeds.sql
-- Skills Library Phase S1 — 3 sample cards for checkpoint verification
--
-- Purpose: satisfy the SL-SCHEMA checkpoint criterion that the library
-- contains real rows. These 3 cards demonstrate:
--   - all 3 difficulty levels
--   - a prereq chain (intermediate → foundational)
--   - tags, external links, structured-block body
--
-- Matt will replace / extend these with his curated MYP Design cards
-- async when he's ready. These seeds are safe to keep — they're marked
-- is_built_in = true so they survive as platform baseline.
--
-- Idempotent via ON CONFLICT DO NOTHING (using slug as the natural key).
-- =====================================================================

-- Deterministic UUIDs so the seeds can be referenced predictably from
-- prereq rows + future tests. Using uuid_generate_v5-like deterministic
-- namespaces would be cleaner, but raw UUIDs are simpler for a seed.
DO $$
DECLARE
  v_id_sketching  uuid := '11111111-1111-1111-1111-111111111101';
  v_id_3d_basics  uuid := '11111111-1111-1111-1111-111111111102';
  v_id_3d_trouble uuid := '11111111-1111-1111-1111-111111111103';
BEGIN
  -- Skill 1: Ideation sketching — foundational, designing
  INSERT INTO skill_cards (id, slug, title, summary, category_id, difficulty, body, is_built_in, is_published)
  VALUES (
    v_id_sketching,
    'ideation-thumbnails',
    'Ideation sketching: thumbnails',
    'Produce multiple quick concept sketches to explore a design space without committing to one idea.',
    'designing',
    'foundational',
    '[
      {"type":"prose","text":"Thumbnails are small, fast, disposable drawings. Aim for quantity before quality — the goal is to generate options, not to produce finished work."},
      {"type":"callout","kind":"rule","text":"Rule of thumb: 10 thumbnails in 10 minutes. If you''re spending more than a minute per thumbnail, you''re overthinking."},
      {"type":"checklist","items":["Keep each sketch under 5cm wide","Use a marker, not a fine pen — no erasing","Vary scale, shape, arrangement","Label with 2-3 words if the idea needs it"]}
    ]'::jsonb,
    true,
    true
  ) ON CONFLICT (slug) DO NOTHING;

  -- Skill 2: 3D Printing basics — foundational, creating
  INSERT INTO skill_cards (id, slug, title, summary, category_id, difficulty, body, is_built_in, is_published)
  VALUES (
    v_id_3d_basics,
    '3d-printing-basic-setup',
    '3D Printing: basic setup',
    'Prepare a part for 3D printing: orient it, add supports if needed, slice, and check the preview before sending to print.',
    'creating',
    'foundational',
    '[
      {"type":"prose","text":"Before any print, walk through the same checklist: orientation, supports, adhesion, layer height, infill. Miss one and you''ll either waste filament or watch a print fail an hour in."},
      {"type":"checklist","items":["Orient for minimum supports","Check first-layer adhesion (skirt/brim)","Use default layer height (0.2mm) unless you have a reason","20% infill is fine for most hobby parts","Preview the slice — look for floating sections"]},
      {"type":"callout","kind":"warning","text":"Never start a print without checking the preview. 10 seconds of checking saves hours of failed print."}
    ]'::jsonb,
    true,
    true
  ) ON CONFLICT (slug) DO NOTHING;

  -- Skill 3: 3D Printing troubleshooting — intermediate, depends on #2
  INSERT INTO skill_cards (id, slug, title, summary, category_id, difficulty, body, is_built_in, is_published)
  VALUES (
    v_id_3d_trouble,
    '3d-printing-troubleshooting',
    '3D Printing: troubleshooting common failures',
    'Recognise the top failure modes (stringing, warping, layer shift, first-layer adhesion) and apply the right fix.',
    'creating',
    'intermediate',
    '[
      {"type":"prose","text":"Most failed prints come from 5 causes. Learning to read the failure is the skill — once you can name it, the fix is usually obvious."},
      {"type":"callout","kind":"tip","text":"When a print fails, take a photo before tearing it off the bed. You''ll want it later to compare against the failure catalogue."},
      {"type":"checklist","items":["Stringing → tune retraction + temperature","Warping → enclosed print area + brim","Layer shift → check belt tension + re-home","First-layer adhesion → bed levelling + cleaning","Under-extrusion → nozzle clean + filament check"]}
    ]'::jsonb,
    true,
    true
  ) ON CONFLICT (slug) DO NOTHING;

  -- Tags
  INSERT INTO skill_card_tags (skill_id, tag) VALUES
    (v_id_sketching,  'design-thinking'),
    (v_id_sketching,  'ideation'),
    (v_id_sketching,  'sketching'),
    (v_id_3d_basics,  'fabrication'),
    (v_id_3d_basics,  '3d-printing'),
    (v_id_3d_basics,  'workshop'),
    (v_id_3d_trouble, 'fabrication'),
    (v_id_3d_trouble, '3d-printing'),
    (v_id_3d_trouble, 'troubleshooting'),
    (v_id_3d_trouble, 'workshop')
  ON CONFLICT (skill_id, tag) DO NOTHING;

  -- Prerequisites — 3D troubleshooting requires 3D basics
  INSERT INTO skill_prerequisites (skill_id, prerequisite_id) VALUES
    (v_id_3d_trouble, v_id_3d_basics)
  ON CONFLICT (skill_id, prerequisite_id) DO NOTHING;

  -- External links (sample — can be populated meaningfully later)
  INSERT INTO skill_external_links (skill_id, url, title, kind, display_order) VALUES
    (v_id_3d_basics,  'https://www.youtube.com/watch?v=T-Z5Z7j9i6E',                 'Prusa — first print walkthrough', 'video', 10),
    (v_id_3d_trouble, 'https://help.prusa3d.com/category/failures-and-other-issues_5', 'Prusa failure catalogue',         'website', 10)
  ON CONFLICT DO NOTHING;
END $$;

COMMENT ON COLUMN skill_cards.is_built_in IS
  'True for platform-seeded baseline cards (including migration-108 seeds). False for teacher-authored cards.';
