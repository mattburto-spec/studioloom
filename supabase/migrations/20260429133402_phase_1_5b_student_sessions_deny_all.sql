-- Phase 1.5b — student_sessions: explicit deny-all policy (closes FU-FF)
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.5 (additive)
-- Closes: FU-FF (P3 — undocumented RLS-as-deny-all on 3 tables)
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- `student_sessions` (mig 001) has RLS enabled but NO policies. Postgres
-- treats this as deny-all-by-default (any non-service-role role gets
-- zero rows on SELECT, can't INSERT/UPDATE/DELETE). The behaviour is
-- intentional — `student_sessions` is the legacy auth table accessed
-- only via the service-role admin client. But it shows up in
-- `docs/scanner-reports/rls-coverage.json` as `rls_enabled_no_policy`
-- drift and was filed as FU-FF (P3 "likely intentional but undocumented").
--
-- Phase 1.2's grace period concern: if any new code path queries
-- `student_sessions` via an SSR/RLS client (instead of the admin client),
-- it silently returns zero rows. With deny-all RLS, that's the right
-- default — but making it explicit prevents a future change from
-- accidentally adding a permissive policy that exposes session tokens.
--
-- This adds an explicit `USING (false)` policy. Service role bypasses
-- RLS regardless. The policy makes the deny intent grep-able and
-- removes the drift entry from the scanner report.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new ALL policy on `student_sessions` with USING (false) + WITH CHECK (false)
-- - Functionally identical to current (deny-by-default) state
-- - Closes FU-FF and removes student_sessions from rls-coverage drift
-- - Service-role admin client paths unaffected (RLS bypass)
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql drops the policy. Safe — falls back to RLS-enabled-no-policy
-- which is functionally the same.

CREATE POLICY "student_sessions_deny_all"
  ON student_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY "student_sessions_deny_all" ON student_sessions IS
  'Phase 1.5b — Explicit deny-all for non-service-role access. Functionally identical to RLS-enabled-no-policy default; this just makes the intent grep-able + closes FU-FF P3. Service-role admin client bypasses RLS.';
