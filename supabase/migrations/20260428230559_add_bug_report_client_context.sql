-- Migration: add_bug_report_client_context
-- Created: 20260428230559 UTC
--
-- WHY: Bug reports currently capture only description, category, page_url, and
-- the last 5 console.error strings. That's not enough to triage real reports —
-- we don't know the browser, OS, viewport, network conditions, or which
-- deployed release the user was on. This adds a single JSONB column to hold
-- arbitrary client-side context (userAgent, platform, viewport, devicePixelRatio,
-- connection.effectiveType, release SHA, unhandledrejection traces, etc.)
-- without a wave of narrow columns.
--
-- IMPACT: Adds bug_reports.client_context JSONB DEFAULT '{}'::jsonb NOT NULL.
-- No index — we triage by status/created_at, not by context fields.
-- No RLS change — existing policies continue to apply at the row level.
-- ROLLBACK: paired .down.sql drops the column.

ALTER TABLE bug_reports
  ADD COLUMN client_context JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN bug_reports.client_context IS
  'Arbitrary client-side context captured at submit time: userAgent, platform, viewport, devicePixelRatio, connection (effectiveType/downlink), release SHA, unhandled error/rejection traces. Schema is intentionally loose — additive only.';
