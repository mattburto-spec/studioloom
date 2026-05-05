/**
 * Notification types — Phase 3A foundation.
 *
 * Generic shell. Consumers extend the `kind` union and embed kind-specific
 * data in `payload`. The DB has NO CHECK constraint on `kind` — this union
 * is the source of truth, asserted by a cross-reference test.
 *
 * See: supabase/migrations/20260504115948_notifications_table.sql
 *      src/lib/notifications/create-notification.ts
 */

export type NotificationKind =
  // Phase 3B (queued)
  | "integrity.flag_low_score"
  // Reserved future phases — listed so tsc catches typos before runtime.
  // When a feature actually starts using these, leave them here; when a
  // value is REMOVED, audit consumers via grep first (Lesson #45).
  | "fab.job_status_change"
  | "unit.use_request"
  | "share.invitation_received";

export type NotificationSeverity = "info" | "warn" | "critical";

export type NotificationRecipientRole =
  | "teacher"
  | "student"
  | "fabricator"
  | "platform_admin";

/** Notification row shape — mirrors the DB columns 1:1. */
export interface Notification {
  id: string;
  recipient_id: string;
  recipient_role: NotificationRecipientRole;
  school_id: string | null;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  dedup_key: string | null;
  link_url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  expires_at: string | null;
}

/**
 * Input shape for createNotification(). Camel-cased; helper translates to
 * snake_case DB columns. Only the required fields are non-optional —
 * everything else has a sensible default at the DB or helper layer.
 */
export interface CreateNotificationInput {
  recipientId: string;
  recipientRole: NotificationRecipientRole;
  kind: NotificationKind;
  title: string;
  schoolId?: string | null;
  /** Defaults to 'info'. */
  severity?: NotificationSeverity;
  body?: string | null;
  /** Defaults to {} at the DB layer. */
  payload?: Record<string, unknown>;
  /** When non-null, second insert with same (recipientId, kind, dedupKey) is a no-op. */
  dedupKey?: string | null;
  linkUrl?: string | null;
  /** ISO 8601 timestamp. NULL = never expires. */
  expiresAt?: string | null;
}

export type CreateNotificationResult =
  | { ok: true; id: string; deduped: boolean }
  | { ok: false; error: string };
