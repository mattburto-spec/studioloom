-- Migration: notifications_table
-- Created: 20260504115948 UTC
-- Phase: Notifications Phase 3A (foundation — generic per-recipient alert table)
--
-- WHY: We have no generic notification system. The existing
--   `unit_use_requests` table is purpose-specific (Phase 4.6 share inbox);
--   `audit_events` is for compliance (immutable, recipient is the system,
--   not a user); `learning_events` is Skills-Library-scoped. Phase 3A
--   builds the missing generic surface so Phase 3B (integrity alert when a
--   student's writing-confidence score drops below a threshold) and future
--   features (fab status changes, share invitations) all plug into one
--   table via the `kind` discriminator + `payload` JSONB.
--
-- IMPACT: 1 new table (`notifications`) + 4 indexes + 2 RLS policies (SELECT
--   self-read, UPDATE self-mutate read/dismissed timestamps only). NO
--   INSERT or DELETE policies — service-role-only via the
--   `createNotification()` helper at src/lib/notifications/create-notification.ts.
--   No backfill. No data migration. RLS deny-by-default for INSERT/DELETE
--   matches the audit_events pattern (Phase 0.7a).
--
-- ROLLBACK: paired .down.sql drops the table.
--
-- Future phases:
--   3B — first consumer: /api/student/progress POST hook fires
--        kind='integrity.flag_low_score' when analyzeIntegrity score < 40.
--   3C — teacher in-app feed at /teacher/notifications + bell unread count.
--   3D — email channel via Resend wrapper + 24h dedup.
--   3E — per-teacher preferences UI (threshold sliders, channel toggles,
--        opt-out). Until 3E lands, every fired notification reaches its
--        named recipient with no per-teacher gate (default-on).

-- ============================================================
-- 1. notifications — generic per-recipient alerts
-- ============================================================
-- recipient_id REFERENCES auth.users (not students/teachers/etc tables)
-- so a single FK covers every recipient role. Phase 3A only fires for
-- recipient_role='teacher' (from Phase 3B); reserved enum values let
-- future phases address students / fabricators / platform_admin without
-- a schema bump.
--
-- school_id is denormalised (also resolvable via recipient → user → school)
-- but kept here for fast school-scoped retention queries (Phase 3D will
-- run a sweep) and audit/analytics joins.
--
-- dedup_key: optional uniqueness scope. When non-null, partial unique
-- index on (recipient_id, kind, dedup_key) makes a second insert with
-- the same triple a no-op (handler in createNotification() catches
-- error.code 23505 and returns deduped:true). Phase 3B uses
-- '<student_id>|<page_id>|<YYYY-MM-DD>' so a teacher gets at most one
-- integrity alert per student-per-page-per-day.

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL
    CHECK (recipient_role IN
      ('teacher', 'student', 'fabricator', 'platform_admin')),
  school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  -- e.g. 'integrity.flag_low_score', 'fab.job_status_change',
  -- 'share.invitation_received'. No CHECK constraint — kinds are added
  -- without schema migration; the TypeScript NotificationKind union is
  -- the source of truth and is asserted by a cross-reference test.
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warn', 'critical')),
  title TEXT NOT NULL,
  body TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedup_key TEXT NULL,
  link_url TEXT NULL,
  read_at TIMESTAMPTZ NULL,
  dismissed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL,
  -- Coherence: read_at and dismissed_at must be NULL or after created_at
  CHECK (read_at IS NULL OR read_at >= created_at),
  CHECK (dismissed_at IS NULL OR dismissed_at >= created_at)
);

-- Bell unread count: per-recipient, only undismissed unread.
-- Most common query: SELECT COUNT(*) WHERE recipient_id = $1 AND read_at IS NULL AND dismissed_at IS NULL
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

-- Dedup uniqueness: same (recipient, kind, dedup_key) only inserts once
-- when dedup_key is non-null. Partial unique constraint = idempotent fire.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_dedup
  ON notifications (recipient_id, kind, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- School-scoped retention queries (Phase 3D cleanup cron)
CREATE INDEX IF NOT EXISTS idx_notifications_school_created
  ON notifications (school_id, created_at DESC)
  WHERE school_id IS NOT NULL;

-- Recipient-level expiry sweep
CREATE INDEX IF NOT EXISTS idx_notifications_expires
  ON notifications (expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================
-- 2. RLS — Phase 3A baseline
-- ============================================================
-- Recipient self-read; recipient self-update of read/dismissed timestamps
-- only. INSERT and DELETE deny-by-default (no policies = no client write).
-- Service-role inserts via createNotification() helper.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_recipient_self_read"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "notifications_recipient_update_own_state"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

COMMENT ON TABLE notifications IS
  'Generic per-recipient notifications. Phase 3A foundation. First consumer: '
  'Phase 3B integrity-alert. Generic by design — kind discriminates, payload '
  'carries kind-specific JSONB. Inserts via createNotification() helper '
  '(service role); SELECT + UPDATE-of-state by recipient via RLS. INSERT + '
  'DELETE deny-by-default (no client policies).';

COMMENT ON COLUMN notifications.dedup_key IS
  'Optional uniqueness scope. Insert with same (recipient_id, kind, dedup_key) '
  'becomes idempotent no-op via partial unique index. Integrity alerts use '
  '<student_id>|<page_id>|<YYYY-MM-DD> to fire at most once per student/page/day.';

COMMENT ON COLUMN notifications.kind IS
  'Discriminator. NO CHECK constraint here — kinds added without schema migration. '
  'TypeScript NotificationKind union (src/types/notifications.ts) is source of truth, '
  'asserted by cross-reference test in __tests__/create-notification.test.ts.';

-- ============================================================
-- 3. Sanity check
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    RAISE EXCEPTION 'Migration failed: notifications table missing';
  END IF;
  RAISE NOTICE 'Migration notifications_table applied OK: 1 table + 4 indexes + 2 RLS policies';
END $$;
