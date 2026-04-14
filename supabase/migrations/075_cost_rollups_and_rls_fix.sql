-- Migration 075: cost_rollups table + FU-X RLS fix
--
-- Creates cost_rollups for per-teacher cost attribution (Phase 7E).
-- Fixes FU-X: enables RLS on 3 unprotected ops tables
-- (usage_rollups, system_alerts, library_health_flags).
--
-- Note: cost_rollups is DISTINCT from usage_rollups (Phase 4 counts).
-- This table stores USD cost data; usage_rollups stores call/block counts.

-- ============================================================
-- 1. CREATE TABLE cost_rollups
-- ============================================================

CREATE TABLE IF NOT EXISTS cost_rollups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category       TEXT NOT NULL CHECK (category IN ('ingestion', 'generation', 'student_api', 'teacher_api')),
  period         TEXT NOT NULL CHECK (period IN ('day', 'week', 'month')),
  period_start   DATE NOT NULL,
  cost_usd       NUMERIC(10,4) NOT NULL DEFAULT 0,
  call_count     INT NOT NULL DEFAULT 0,
  token_count    INT NOT NULL DEFAULT 0,
  rolled_up_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup constraint: one row per teacher × category × period × start
ALTER TABLE cost_rollups
  ADD CONSTRAINT cost_rollups_unique_teacher_category_period
  UNIQUE (teacher_id, category, period, period_start);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_cost_rollups_teacher_period
  ON cost_rollups (teacher_id, period, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_cost_rollups_category
  ON cost_rollups (category, period_start DESC);

-- ============================================================
-- 2. RLS on cost_rollups
-- ============================================================

ALTER TABLE cost_rollups ENABLE ROW LEVEL SECURITY;

-- Teachers read their own cost data
DROP POLICY IF EXISTS "Teachers read own cost rollups" ON public.cost_rollups;
CREATE POLICY "Teachers read own cost rollups"
  ON cost_rollups FOR SELECT
  USING (teacher_id = auth.uid());

-- Service role full access (nightly rollup job writes via createAdminClient)
DROP POLICY IF EXISTS "Service role full access cost_rollups" ON public.cost_rollups;
CREATE POLICY "Service role full access cost_rollups"
  ON cost_rollups FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 3. FU-X FIX: RLS on usage_rollups
--    Written by: src/lib/jobs/usage-analytics.ts (service_role)
--    Read by: admin dashboard (service_role)
--    Teacher-partitioned (teacher_id column) — teacher sees own rows.
-- ============================================================

ALTER TABLE usage_rollups ENABLE ROW LEVEL SECURITY;

-- Teachers read their own usage data
DROP POLICY IF EXISTS "Teachers read own usage rollups" ON public.usage_rollups;
CREATE POLICY "Teachers read own usage rollups"
  ON usage_rollups FOR SELECT
  USING (teacher_id = auth.uid());

-- Service role full access (Job 7 writes daily via createAdminClient)
DROP POLICY IF EXISTS "Service role full access usage_rollups" ON public.usage_rollups;
CREATE POLICY "Service role full access usage_rollups"
  ON usage_rollups FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. FU-X FIX: RLS on system_alerts
--    Written by: 9 job files (service_role)
--    Read by: /api/admin/pipeline/health (service_role)
--    Admin/service-role only — no teacher or student access.
-- ============================================================

ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Service role full access (jobs write, admin routes read)
DROP POLICY IF EXISTS "Service role full access system_alerts" ON public.system_alerts;
CREATE POLICY "Service role full access system_alerts"
  ON system_alerts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 5. FU-X FIX: RLS on library_health_flags
--    Written by: src/lib/jobs/library-hygiene-weekly.ts (service_role)
--    Read by: admin dashboard (service_role)
--    Admin/service-role only — no teacher or student access.
-- ============================================================

ALTER TABLE library_health_flags ENABLE ROW LEVEL SECURITY;

-- Service role full access (hygiene job writes, admin reads)
DROP POLICY IF EXISTS "Service role full access library_health_flags" ON public.library_health_flags;
CREATE POLICY "Service role full access library_health_flags"
  ON library_health_flags FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
