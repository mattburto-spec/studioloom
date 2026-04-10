-- ============================================================
-- Migration 066: generation_runs.is_sandbox flag
-- Phase 0 (Dimensions3 Completion Spec §2.10), 10 Apr 2026
-- ============================================================
--
-- Phase 7 (§9.1) assumes a boolean flag on generation_runs so that
-- sandbox runs from the upcoming Generation Sandbox (§7.2) do not
-- pollute live cost / quality analytics. Added here in Phase 0 so the
-- column is ready before any sandbox code lands.
--
-- Default is false — all historical runs are treated as live.
--
-- NOTE: Phase 4 dashboard queries will need to add
--   WHERE is_sandbox = false
-- when surfacing live analytics. Not yet applied in this migration.
-- ============================================================

ALTER TABLE generation_runs
  ADD COLUMN is_sandbox BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_generation_runs_sandbox
  ON generation_runs(is_sandbox, created_at DESC);
