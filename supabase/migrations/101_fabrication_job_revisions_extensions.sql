-- Migration 101: fabrication_job_revisions — AI cost tracking + multi-angle thumbnails
--
-- Preflight Phase 1B-1-4. Two nullable additive columns on an existing table
-- (fabrication_job_revisions created in migration 095). No RLS changes —
-- columns inherit the existing policies from 095.
--
-- Refs:
--   - Brief:      docs/projects/preflight-phase-1b-1-brief.md (1B-1-4)
--   - Candidates: docs/projects/fabrication/migration-098-candidates.md (098f, 098g)
--   - Lessons:    #24 (idempotent guards), #45 (surgical), #51 (no DO blocks)

-- ============================================================
-- 1. ADD COLUMNS (idempotent guards)
-- ============================================================

ALTER TABLE fabrication_job_revisions
  ADD COLUMN IF NOT EXISTS ai_enrichment_cost_usd NUMERIC;

ALTER TABLE fabrication_job_revisions
  ADD COLUMN IF NOT EXISTS thumbnail_views JSONB;

-- ============================================================
-- 2. Column documentation
-- ============================================================

COMMENT ON COLUMN fabrication_job_revisions.ai_enrichment_cost_usd IS
  'Per-scan AI enrichment spend in USD (candidate 098f). NULL = enrichment '
  'disabled or skipped for this revision; 0 = ran with full cache hit; '
  '>0 = actual Haiku spend. Phase 2 worker sums today''s rows against '
  'admin_settings.preflight.ai_enrichment_daily_cap_usd before dispatching.';

COMMENT ON COLUMN fabrication_job_revisions.thumbnail_views IS
  'Multi-angle preview + heatmap metadata (candidate 098g). Shape: '
  '{views: {iso, front, side, top, walls_heatmap, overhangs_heatmap}, '
  'annotations: [{view, bbox, rule_id}]}. Phase 2 scanner populates; '
  'Phase 1B-2 student UI renders inline SVG overlay from annotations.';

-- ============================================================
-- 3. Post-apply verification (run as separate queries in the dashboard)
-- ============================================================
-- No DO block per Lesson #51.
--
--   -- (a) Both columns present with correct shape
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'fabrication_job_revisions'
--     AND column_name IN ('ai_enrichment_cost_usd', 'thumbnail_views')
--   ORDER BY column_name;
--   -- Expected 2 rows:
--   --   ai_enrichment_cost_usd | numeric | YES
--   --   thumbnail_views        | jsonb   | YES
--
--   -- (b) Comments present on both
--   SELECT
--     column_name,
--     pg_catalog.col_description(
--       (SELECT oid FROM pg_catalog.pg_class WHERE relname='fabrication_job_revisions'),
--       ordinal_position
--     ) AS comment
--   FROM information_schema.columns
--   WHERE table_name = 'fabrication_job_revisions'
--     AND column_name IN ('ai_enrichment_cost_usd', 'thumbnail_views')
--   ORDER BY column_name;
--   -- Expected 2 rows with non-null comments starting "Per-scan AI…" / "Multi-angle preview…"
--
--   -- (c) No revisions yet (table empty anyway) — both columns NULL
--   SELECT
--     COUNT(*)                                         AS total,
--     COUNT(ai_enrichment_cost_usd)                    AS cost_non_null,
--     COUNT(thumbnail_views)                           AS views_non_null
--   FROM fabrication_job_revisions;
--   -- Expected: total = 0, cost_non_null = 0, views_non_null = 0
--
--   -- (d) RLS policy count unchanged from migration 095 baseline
--   SELECT COUNT(*) FROM pg_policies WHERE tablename = 'fabrication_job_revisions';
--   -- Expected: same as before 101 (095's policies — no change here)
