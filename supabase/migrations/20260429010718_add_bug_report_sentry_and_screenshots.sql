-- Migration: add_bug_report_sentry_and_screenshots
-- Created: 20260429010718 UTC
--
-- WHY: Two additions to the bug-report pipeline.
--   1. sentry_event_id column on bug_reports — when a user submits a report,
--      we now also call Sentry.captureMessage() with their context. The
--      returned event_id is stored here so the admin UI can deep-link to
--      the Sentry event (which has stack traces + breadcrumbs we don't
--      want to duplicate in our own DB).
--   2. New private Storage bucket `bug-report-screenshots` for the
--      screenshot-attach feature. Service-role-only RLS following the
--      same pattern as migration 102 (Preflight buckets). Admins view
--      via signed URLs minted server-side.
--
-- IMPACT:
--   - Adds bug_reports.sentry_event_id TEXT NULL.
--   - Inserts row into storage.buckets for `bug-report-screenshots`.
--   - Adds one storage.objects RLS policy scoped to the new bucket.
-- ROLLBACK: paired .down.sql drops the column + policy + bucket.

-- ============================================================
-- 1. Sentry event id column
-- ============================================================

ALTER TABLE bug_reports
  ADD COLUMN sentry_event_id TEXT;

COMMENT ON COLUMN bug_reports.sentry_event_id IS
  'Sentry event ID returned by Sentry.captureMessage() at submit time. Use to deep-link from admin UI to the Sentry event view (which has stack traces, breadcrumbs, and the full error context we do not duplicate locally).';

-- ============================================================
-- 2. Screenshots Storage bucket (private; signed-URL access only)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-report-screenshots', 'bug-report-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. RLS policy on storage.objects — service-role only
-- ============================================================
-- Same pattern as fabrication buckets (migration 102): service-role
-- bypasses RLS by default in Supabase, so the API route can write +
-- read with the admin client. No authenticated/anon role can touch
-- these — admins view via signed URLs minted server-side.

DROP POLICY IF EXISTS "bug_report_screenshots_service_role_all" ON storage.objects;
CREATE POLICY "bug_report_screenshots_service_role_all"
  ON storage.objects FOR ALL
  USING      (bucket_id = 'bug-report-screenshots' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'bug-report-screenshots' AND auth.role() = 'service_role');

-- ============================================================
-- 4. Post-apply verification (paste into SQL editor)
-- ============================================================
--   SELECT id, public FROM storage.buckets WHERE id = 'bug-report-screenshots';
--   -- Expected: 1 row, public=false.
--
--   SELECT policyname FROM pg_policies
--   WHERE schemaname='storage' AND tablename='objects'
--     AND policyname='bug_report_screenshots_service_role_all';
--   -- Expected: 1 row.
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='bug_reports' AND column_name='sentry_event_id';
--   -- Expected: 1 row.
