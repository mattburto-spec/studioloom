-- Migration 098: fabrication_jobs — pre-check intent, printing sub-state, notification audit
--
-- Preflight Phase 1B-1-1. Three nullable column additions to the existing
-- fabrication_jobs table (created in migration 095). All additive, no backfill,
-- no RLS changes (inherits the dual-visibility teacher RLS from 095).
--
-- Refs:
--   - Brief:      docs/projects/preflight-phase-1b-1-brief.md (1B-1-1)
--   - Candidates: docs/projects/fabrication/migration-098-candidates.md (098a, 098c, 098d)
--   - Mockups:    docs/projects/fabrication/ui-mockups-v0.md (§1.2 new-submission + §Q5-6 notifications)
--   - Spec:       docs/projects/fabrication-pipeline.md §11, §8 (soft-gate UX)
--   - Lessons:    #24 (idempotent guards), #45 (surgical — ONLY these 3 columns), #51 (no DO verify blocks)
--
-- Deliberately NOT adding indexes — these columns are not in hot query paths
-- for v1. Revisit in Phase 2 if the scanner worker or teacher dashboard shows
-- performance issues. (Lesson #44 — simplicity; no speculative flexibility.)

-- ============================================================
-- 1. ADD COLUMNs (idempotent guards — safe to re-run)
-- ============================================================

ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS student_intent JSONB;

ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS printing_started_at TIMESTAMPTZ;

ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS notifications_sent JSONB;

-- ============================================================
-- 2. Column documentation
-- ============================================================

COMMENT ON COLUMN fabrication_jobs.student_intent IS
  'Pre-check answers from new-submission form (candidate 098a). JSONB shape: '
  '{size_bucket: "hand"|"a4_or_smaller"|"bigger", designed_units: "mm"|"cm"|"inch", '
  'chosen_material: string, description?: string}. Consumed by scanner worker '
  'for context + AI enrichment (R-AI-01..04). NULL = legacy submission or '
  'pre-form upload path.';

COMMENT ON COLUMN fabrication_jobs.printing_started_at IS
  'Timestamp when Fabricator pressed Start printing on the machine (candidate 098c). '
  'status=picked_up + NULL = downloaded, not yet printing. '
  'status=picked_up + timestamp = currently printing. '
  'Derived state; avoids adding a new status enum value.';

COMMENT ON COLUMN fabrication_jobs.notifications_sent IS
  'Email dispatch idempotency audit (candidate 098d). JSONB shape: '
  '{approved_at?, returned_at?, rejected_at?, picked_up_at?, '
  'printing_started_at?, completed_at?}. Route checks "already sent?" '
  'before firing email, prevents double-sends on retries.';

-- ============================================================
-- 3. Post-apply verification (run as separate queries in Supabase dashboard)
-- ============================================================
-- No DO $$ verify block (Lesson #51 — dashboard mis-parses DECLARE variables).
-- Run these three queries after apply:
--
--   -- (a) Columns exist, correct types, all nullable
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'fabrication_jobs'
--     AND column_name IN ('student_intent', 'printing_started_at', 'notifications_sent')
--   ORDER BY column_name;
--   -- Expected 3 rows:
--   --   notifications_sent     | jsonb                       | YES
--   --   printing_started_at    | timestamp with time zone    | YES
--   --   student_intent         | jsonb                       | YES
--
--   -- (b) Column comments present
--   SELECT cols.column_name, pg_catalog.col_description(pgc.oid, cols.ordinal_position)
--   FROM pg_catalog.pg_class pgc
--   JOIN information_schema.columns cols ON cols.table_name = pgc.relname
--   WHERE pgc.relname = 'fabrication_jobs'
--     AND cols.column_name IN ('student_intent', 'printing_started_at', 'notifications_sent')
--   ORDER BY cols.column_name;
--   -- Expected: 3 rows, each with a non-null comment starting with
--   -- "Pre-check answers…", "Timestamp when Fabricator…", "Email dispatch…"
--
--   -- (c) RLS policies unchanged (still 2 from migration 095)
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'fabrication_jobs' ORDER BY cmd, policyname;
--   -- Expected 2 rows:
--   --   fabrication_jobs_select_teacher | SELECT
--   --   fabrication_jobs_update_teacher | UPDATE
