-- Migration state probe — tells you which migrations are already
-- applied to this Supabase instance by looking for the schema artefacts
-- each one creates. Pure READ queries (no writes, idempotent, safe to
-- re-run any time).
--
-- Context: Supabase dashboard SQL Editor applies don't leave an audit
-- trail in supabase_migrations.schema_migrations (that table only tracks
-- CLI-driven migrations). So "what's applied" is detected by checking
-- which tables/columns/indexes now exist.
--
-- Usage: paste the whole file into Supabase SQL Editor → Run. One row
-- per migration. `applied_verdict` column tells you the state:
--   APPLIED     — the expected schema artefact exists
--   NOT APPLIED — missing
--   PARTIAL     — some artefacts present, some missing (rare — means
--                 the migration crashed midway; re-run should be safe
--                 if idempotent)

WITH migration_checks AS (
  -- ============================================================
  -- Migration 110: skills_library_world_class_schema
  -- Expected: skill_tiers enum OR skill_cards.tier column
  -- ============================================================
  SELECT
    '110_skills_library_world_class_schema' AS migration,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'skill_cards' AND column_name = 'tier'
      ) THEN 'APPLIED'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'skill_cards'
      ) THEN 'NOT APPLIED (skill_cards exists but no tier column yet)'
      ELSE 'NOT APPLIED (skill_cards table missing — check 109 first)'
    END AS applied_verdict,
    'Check: skill_cards.tier column' AS probe

  UNION ALL

  -- ============================================================
  -- Migration 111: skill_card_refs (main branch version)
  -- Expected: skill_card_refs table
  -- ============================================================
  SELECT
    '111_skill_card_refs (main branch)' AS migration,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'skill_card_refs'
      ) THEN 'APPLIED'
      ELSE 'NOT APPLIED'
    END AS applied_verdict,
    'Check: skill_card_refs table exists' AS probe

  UNION ALL

  -- ============================================================
  -- Migration 112: skill_card_quiz (main branch)
  -- Expected: skill_card_quiz table (or quiz column on skill_cards —
  -- need to confirm exact shape; checking both)
  -- ============================================================
  SELECT
    '112_skill_card_quiz (main branch)' AS migration,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'skill_card_quiz'
      ) THEN 'APPLIED (table)'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'skill_cards' AND column_name LIKE 'quiz%'
      ) THEN 'APPLIED (column)'
      ELSE 'NOT APPLIED'
    END AS applied_verdict,
    'Check: skill_card_quiz table OR skill_cards.quiz* column' AS probe

  UNION ALL

  -- ============================================================
  -- Migration 113: fabrication_labs (Phase 8-1, not yet applied to prod)
  -- Expected: fabrication_labs table
  -- ============================================================
  SELECT
    '113_fabrication_labs (Phase 8-1)' AS migration,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'fabrication_labs'
      ) THEN 'APPLIED'
      ELSE 'NOT APPLIED (expected — apply this next)'
    END AS applied_verdict,
    'Check: fabrication_labs table exists' AS probe

  UNION ALL

  -- ============================================================
  -- Migration 114: backfill_fabrication_labs
  -- Expected: at least one default lab AND at least one machine_profile
  -- with lab_id populated (for any teacher with machines)
  -- ============================================================
  SELECT
    '114_backfill_fabrication_labs (Phase 8-1)' AS migration,
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'fabrication_labs'
      ) THEN 'NOT APPLIED (depends on 113)'
      WHEN EXISTS (SELECT 1 FROM fabrication_labs WHERE is_default = true)
       AND NOT EXISTS (
         SELECT 1 FROM machine_profiles
         WHERE teacher_id IS NOT NULL AND is_system_template = false AND lab_id IS NULL
       )
      THEN 'APPLIED'
      WHEN EXISTS (SELECT 1 FROM fabrication_labs WHERE is_default = true)
      THEN 'PARTIAL (default labs exist but some teacher-owned machines still unassigned — re-run is safe)'
      ELSE 'NOT APPLIED'
    END AS applied_verdict,
    'Check: ≥1 default lab AND zero teacher-owned machines with NULL lab_id' AS probe

  UNION ALL

  -- ============================================================
  -- Migration 115: pypx_exhibition (dashboard-v2-build, originally 111)
  -- Expected: class_units.exhibition_config column + student_projects table
  -- ============================================================
  SELECT
    '115_pypx_exhibition (dashboard, renumbered from 111)' AS migration,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'class_units' AND column_name = 'exhibition_config'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'student_projects'
      )
      THEN 'APPLIED'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'class_units' AND column_name = 'exhibition_config'
      )
      OR EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'student_projects'
      )
      THEN 'PARTIAL (one of two artefacts missing — investigate)'
      ELSE 'NOT APPLIED'
    END AS applied_verdict,
    'Check: class_units.exhibition_config column + student_projects table' AS probe
)
SELECT * FROM migration_checks ORDER BY migration;
