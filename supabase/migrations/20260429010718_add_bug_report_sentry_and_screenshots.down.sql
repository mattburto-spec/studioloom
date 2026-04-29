-- Rollback for: add_bug_report_sentry_and_screenshots
-- Pairs with: 20260429010718_add_bug_report_sentry_and_screenshots.sql

-- Drop policy first (depends on bucket)
DROP POLICY IF EXISTS "bug_report_screenshots_service_role_all" ON storage.objects;

-- Delete any objects in the bucket so the bucket delete succeeds
DELETE FROM storage.objects WHERE bucket_id = 'bug-report-screenshots';

-- Drop the bucket
DELETE FROM storage.buckets WHERE id = 'bug-report-screenshots';

-- Drop the column
ALTER TABLE bug_reports
  DROP COLUMN IF EXISTS sentry_event_id;
