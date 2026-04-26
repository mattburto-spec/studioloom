-- Migration 119: machine_profiles.machine_brand column.
--
-- Phase 8.1d-14. Until now the brand was implicit in `name` (e.g.
-- "Bambu Lab P1S" baked the brand into the display string). The
-- moment a teacher renames a machine to something custom — "Alpha",
-- "Lab printer 3", "🟣" — the brand is lost. Schools can't see "this
-- is a Bambu" at a glance, and downstream features that want
-- per-brand behaviour (PH9-FU-MACHINE-PHOTOS, future filament-loadout
-- per AMS, brand-specific GCODE preflight) have nothing to key off.
--
-- Add a separate `machine_brand` column. `name` becomes the
-- teacher's display label (free to be "Alpha"); `machine_brand` +
-- `machine_model` carry the structural identity.
--
-- Backfill strategy:
--   1. System templates — explicit per-row UPDATE keyed on `name`
--      (the seed names are stable). 12 rows.
--   2. Teacher-owned rows — heuristic LEFT JOIN on `machine_model`
--      to a system template with the same model. Catches rows
--      created from templates (the common path); leaves rows with
--      no template match as NULL (teacher can edit).
--
-- No NOT NULL constraint — pre-118 data may have NULL brand
-- legitimately, and "from scratch" creation should remain valid
-- without forcing a brand. UI nudges but doesn't require.

ALTER TABLE machine_profiles
  ADD COLUMN IF NOT EXISTS machine_brand TEXT;

-- ============================================================
-- 1. Backfill system templates by exact name match.
--    These are the 12 seeded templates from migration 094.
-- ============================================================

UPDATE machine_profiles SET machine_brand = 'Bambu Lab'
  WHERE is_system_template = true AND name IN ('Bambu Lab X1 Carbon', 'Bambu Lab P1S');

UPDATE machine_profiles SET machine_brand = 'Prusa Research'
  WHERE is_system_template = true AND name = 'Prusa MK4S';

UPDATE machine_profiles SET machine_brand = 'Creality'
  WHERE is_system_template = true AND name = 'Creality Ender 3 V2';

UPDATE machine_profiles SET machine_brand = 'Ultimaker'
  WHERE is_system_template = true AND name = 'Ultimaker S3';

UPDATE machine_profiles SET machine_brand = 'MakerBot'
  WHERE is_system_template = true AND name = 'Makerbot Replicator+';

UPDATE machine_profiles SET machine_brand = 'Glowforge'
  WHERE is_system_template = true AND name IN ('Glowforge Pro', 'Glowforge Plus');

UPDATE machine_profiles SET machine_brand = 'xTool'
  WHERE is_system_template = true AND name IN ('xTool M1', 'xTool P2', 'xTool S1');

UPDATE machine_profiles SET machine_brand = 'Gweike'
  WHERE is_system_template = true AND name = 'Gweike Cloud Pro';

-- ============================================================
-- 2. Heuristic backfill for teacher-owned rows.
--    Match on machine_model — most teacher rows came from a
--    template (Phase 8-1 backfill or Phase 8-3 modal-from-template).
--    Rows with NULL or non-matching machine_model stay NULL;
--    teacher fills via edit.
-- ============================================================

UPDATE machine_profiles teacher
SET machine_brand = template.machine_brand
FROM machine_profiles template
WHERE teacher.is_system_template = false
  AND teacher.machine_brand IS NULL
  AND template.is_system_template = true
  AND template.machine_brand IS NOT NULL
  AND teacher.machine_model IS NOT NULL
  AND teacher.machine_model = template.machine_model;

-- ============================================================
-- Sanity probe (run separately in Supabase dashboard):
--   SELECT machine_brand, COUNT(*)
--   FROM machine_profiles
--   WHERE is_system_template = true
--   GROUP BY machine_brand
--   ORDER BY machine_brand NULLS LAST;
--   -- Expect: 7 brands, no NULL.
--
--   SELECT
--     COUNT(*) FILTER (WHERE machine_brand IS NOT NULL) AS with_brand,
--     COUNT(*) FILTER (WHERE machine_brand IS NULL)     AS without_brand
--   FROM machine_profiles
--   WHERE is_system_template = false;
--   -- Most rows should land in `with_brand`; `without_brand` is the
--   -- bin of pre-template-era custom machines that need manual edit.
-- ============================================================
