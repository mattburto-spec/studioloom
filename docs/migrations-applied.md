# Migrations Applied

> Canonical log of which migrations have been applied to prod Supabase, by whom, and when.
> See also `docs/schema-registry.yaml` for per-table details and `supabase/migrations/` for SQL source.

| # | File | Applied | By | Notes |
|---|------|---------|-----|-------|
| 079 | `079_admin_audit_log.sql` | 2026-04-14 | Matt | Phase 7A. Service-role-only (RLS enabled, policy_count=0 — intentional per FU-FF pattern). |
