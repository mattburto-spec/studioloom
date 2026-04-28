-- Rollback for: add_bug_report_client_context
-- Pairs with: 20260428230559_add_bug_report_client_context.sql

ALTER TABLE bug_reports
  DROP COLUMN IF EXISTS client_context;
