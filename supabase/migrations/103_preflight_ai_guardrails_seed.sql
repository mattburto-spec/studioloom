-- Migration 103: admin_settings seed — Preflight AI enrichment guardrails
--
-- Preflight Phase 1B-1-6. Inserts 3 rows into the existing admin_settings
-- table (migration 077). No schema change; pure data seed with idempotent
-- ON CONFLICT (key) DO NOTHING. Matt can retune values later via the
-- /admin/controls UI once Phase 7I wires Preflight panels.
--
-- Refs:
--   - Brief:      docs/projects/preflight-phase-1b-1-brief.md (1B-1-6)
--   - Candidates: docs/projects/fabrication/migration-098-candidates.md (098i)
--   - Table:      supabase/migrations/077_admin_settings.sql
--   - Lessons:    #24 (idempotent), #45 (surgical), #51 (no DO blocks)

-- ============================================================
-- 1. Seed 3 Preflight AI-guardrail keys (idempotent)
-- ============================================================

INSERT INTO admin_settings (key, value) VALUES
  ('preflight.ai_enrichment_enabled',         'true'::jsonb),
  ('preflight.ai_enrichment_daily_cap_usd',   '5.00'::jsonb),
  ('preflight.ai_enrichment_tiers_enabled',   '["tier1"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. Post-apply verification (run as separate queries in the dashboard)
-- ============================================================
-- No DO block per Lesson #51.
--
--   -- (a) All 3 keys present with expected values
--   SELECT key, value
--   FROM admin_settings
--   WHERE key LIKE 'preflight.ai_enrichment_%'
--   ORDER BY key;
--   -- Expected 3 rows:
--   --   preflight.ai_enrichment_daily_cap_usd → 5.00
--   --   preflight.ai_enrichment_enabled       → true
--   --   preflight.ai_enrichment_tiers_enabled → ["tier1"]
--
--   -- (b) No extra Preflight keys leaked in by accident
--   SELECT COUNT(*)
--   FROM admin_settings
--   WHERE key LIKE 'preflight.%';
--   -- Expected: 3
--
--   -- (c) updated_at fresh (ensures they were just inserted, not stale)
--   SELECT key, updated_at > (now() - INTERVAL '1 hour') AS recent
--   FROM admin_settings
--   WHERE key LIKE 'preflight.ai_enrichment_%'
--   ORDER BY key;
--   -- Expected 3 rows, all recent=true on first apply
--   -- (If re-running, ON CONFLICT DO NOTHING keeps original updated_at — recent=false is fine then.)
--
-- ============================================================
-- 3. Runtime consumer notes (no SQL — reference only)
-- ============================================================
--
-- Phase 2 scanner worker reads these before every Haiku enrichment call:
--
--   1. If preflight.ai_enrichment_enabled = false → skip AI, return scan-only result.
--   2. Sum today's fabrication_job_revisions.ai_enrichment_cost_usd:
--        SELECT COALESCE(SUM(ai_enrichment_cost_usd), 0)
--        FROM fabrication_job_revisions
--        WHERE created_at >= date_trunc('day', now());
--      If sum >= preflight.ai_enrichment_daily_cap_usd →
--        skip AI + INSERT into system_alerts (tier: 'warning', key: 'preflight_daily_cap_hit').
--   3. Filter planned enrichment tasks to only those whose tier is in
--      preflight.ai_enrichment_tiers_enabled. Tier 1 = safety-critical
--      (overhang / wall-thickness / trapped-volume). Tier 2/3 enabled
--      post-validation via /admin/controls (Phase 7I).
