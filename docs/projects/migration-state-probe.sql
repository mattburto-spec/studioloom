-- Migration state probe — tells you which migrations are already
-- applied to this Supabase instance by inspecting `information_schema`
-- for the tables / columns each migration creates. Pure metadata reads,
-- no reference to the actual tables — so it works even when a migration
-- hasn't been applied yet. Safe to re-run any time.
--
-- Context: Supabase dashboard SQL Editor applies don't leave an audit
-- trail in supabase_migrations.schema_migrations (that table only
-- tracks CLI-driven migrations). So "what's applied" is detected by
-- checking which schema artefacts now exist.
--
-- Usage: paste the whole file into Supabase SQL Editor → Run. One row
-- per migration. `applied_verdict` column tells you the state:
--   APPLIED     — expected schema artefact exists
--   NOT APPLIED — missing
--   PARTIAL     — some artefacts present, some missing (rare — means
--                 the migration crashed midway; re-run should be safe
--                 if idempotent)
--
-- Note: 114 (backfill) is detected by CHECKING WHETHER the columns
-- from 113 still have any NULLs on teacher-owned rows. That row-level
-- check is a separate query at the bottom — run it only AFTER 113's
-- verdict is APPLIED, to avoid the "relation does not exist" parse
-- error you hit with the unified version.

SELECT
  '110_skills_library_world_class_schema' AS migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'skill_cards' AND column_name = 'tier'
    ) THEN 'APPLIED'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'skill_cards'
    ) THEN 'NOT APPLIED (skill_cards exists but no tier column)'
    ELSE 'NOT APPLIED (skill_cards table missing — 109 not applied either)'
  END AS applied_verdict,
  'skill_cards.tier column' AS probe

UNION ALL

SELECT
  '111_skill_card_refs (main branch)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'skill_card_refs'
    ) THEN 'APPLIED'
    ELSE 'NOT APPLIED'
  END,
  'skill_card_refs table'

UNION ALL

SELECT
  '112_skill_card_quiz (main branch)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'skill_card_quiz'
    ) THEN 'APPLIED (table)'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'skill_cards' AND column_name LIKE 'quiz%'
    ) THEN 'APPLIED (column)'
    ELSE 'NOT APPLIED'
  END,
  'skill_card_quiz table OR skill_cards.quiz* column'

UNION ALL

SELECT
  '113_fabrication_labs (Phase 8-1)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'fabrication_labs'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'machine_profiles' AND column_name = 'lab_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'default_lab_id'
    ) THEN 'APPLIED'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'fabrication_labs'
    ) THEN 'PARTIAL (fabrication_labs table exists but FK columns missing)'
    ELSE 'NOT APPLIED'
  END,
  'fabrication_labs table + machine_profiles.lab_id + classes.default_lab_id'

UNION ALL

SELECT
  '114_backfill_fabrication_labs (Phase 8-1)',
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'fabrication_labs'
    ) THEN 'NOT APPLIED (depends on 113)'
    ELSE 'RUN STEP-2 QUERY BELOW (requires table-level count)'
  END,
  'Requires row-level check — see Step 2 at bottom of file'

UNION ALL

SELECT
  '115_pypx_exhibition (dashboard, renumbered from 111)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'class_units' AND column_name = 'exhibition_config'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'student_projects'
    )
    THEN 'APPLIED'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'class_units' AND column_name = 'exhibition_config'
    )
    OR EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'student_projects'
    )
    THEN 'PARTIAL (one of two artefacts missing — investigate)'
    ELSE 'NOT APPLIED'
  END,
  'class_units.exhibition_config column + student_projects table'

ORDER BY migration;


-- ============================================================
-- STEP 2 (run separately, ONLY if 113 came back APPLIED above):
-- ============================================================
-- Copy-paste the following query separately AFTER confirming 113
-- is APPLIED. It does row-level counts on fabrication_labs +
-- machine_profiles, so it errors with "relation does not exist" if
-- 113 wasn't run yet.
--
-- SELECT
--   'default_labs_count' AS metric,
--   COUNT(*)::text AS value
-- FROM fabrication_labs WHERE is_default = true
-- UNION ALL
-- SELECT
--   'teacher_owned_machines_missing_lab_id',
--   COUNT(*)::text
-- FROM machine_profiles
-- WHERE teacher_id IS NOT NULL AND is_system_template = false AND lab_id IS NULL
-- UNION ALL
-- SELECT
--   'classes_missing_default_lab_id',
--   COUNT(*)::text
-- FROM classes
-- WHERE teacher_id IS NOT NULL AND default_lab_id IS NULL;
--
-- Interpretation:
-- - default_labs_count > 0 AND missing counts both = 0 → 114 APPLIED ✅
-- - default_labs_count > 0 BUT missing counts > 0         → PARTIAL ⚠️
--                                                           (re-run 114 — idempotent)
-- - default_labs_count = 0                                → 114 NOT APPLIED
