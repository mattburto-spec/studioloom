/**
 * createNotification — single typed entry point for notifications INSERT.
 *
 * Phase 3A of Notifications — see migration
 * supabase/migrations/20260504115948_notifications_table.sql.
 *
 * Behaviour:
 *   - Server-side service-role insert. RLS denies client INSERT by default
 *     (no INSERT policy on the notifications table).
 *   - Idempotent when `dedupKey` is non-null. Second insert with the same
 *     (recipientId, kind, dedupKey) returns ok:true with deduped:true.
 *     Backed by the partial unique index uniq_notifications_dedup.
 *   - Audit emission: fire-and-forget logAuditEvent() with
 *     failureMode='soft-sentry' so audit gaps go to Sentry without
 *     breaking the notification flow.
 *
 * Authorization is the caller's responsibility. This helper does NOT
 * check `can(actor, 'notify', recipient)` — the calling route gates on
 * class membership / role / school scope before calling. Phase 3B (the
 * first consumer) will resolve recipient list via class_members.
 *
 * Lessons applied: #38 (assert payload shape), #44 (no abstraction layer),
 * #45 (surgical — one helper, no consumer wiring in 3A).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/access-v2/audit-log";
import type {
  CreateNotificationInput,
  CreateNotificationResult,
} from "@/types/notifications";

export async function createNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  const row = {
    recipient_id: input.recipientId,
    recipient_role: input.recipientRole,
    school_id: input.schoolId ?? null,
    kind: input.kind,
    severity: input.severity ?? "info",
    title: input.title,
    body: input.body ?? null,
    payload: input.payload ?? {},
    dedup_key: input.dedupKey ?? null,
    link_url: input.linkUrl ?? null,
    expires_at: input.expiresAt ?? null,
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    // Unique violation on partial dedup index = idempotent no-op.
    // Postgres SQLSTATE 23505 = unique_violation.
    if (error.code === "23505" && input.dedupKey != null) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("recipient_id", input.recipientId)
        .eq("kind", input.kind)
        .eq("dedup_key", input.dedupKey)
        .maybeSingle();
      return {
        ok: true,
        id: (existing as { id: string } | null)?.id ?? "",
        deduped: true,
      };
    }
    return { ok: false, error: error.message };
  }

  // Fire-and-forget audit emission. soft-sentry: gaps go to Sentry but
  // the notification insert is the load-bearing action — don't break it
  // on audit failure.
  void logAuditEvent(supabase, {
    actorId: null, // System-fired notifications; the *cause* is logged by the calling route's own audit event.
    actorType: "system",
    action: "notification.created",
    targetTable: "notifications",
    targetId: data.id,
    schoolId: input.schoolId ?? null,
    payload: {
      kind: input.kind,
      severity: input.severity ?? "info",
      recipient_role: input.recipientRole,
    },
    severity: input.severity ?? "info",
    failureMode: "soft-sentry",
  });

  return { ok: true, id: data.id, deduped: false };
}
