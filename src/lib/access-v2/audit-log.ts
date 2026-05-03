/**
 * logAuditEvent — single typed entry point for audit_events INSERT.
 *
 * Phase 5.1 of Access Model v2 — see docs/projects/access-model-v2-phase-5-brief.md §5.1.
 * Wraps the audit_events table (mig 20260428215923) so every mutation route
 * has one consistent audit-emit shape + 3-mode failure handling.
 *
 * Behaviour:
 *   - Auto-resolves school_subscription_tier_at_event from schools.subscription_tier
 *     (single read; failure here logs NULL rather than failing the audit insert).
 *   - Default failureMode = 'throw' (atomic with the action).
 *   - 'soft-warn'  — console.warn + return {error}. Use ONLY for student-classcode-login
 *                    (auth flow must not break on audit slowness).
 *   - 'soft-sentry' — Sentry.captureException + console.warn + return {error}.
 *                    Use for routes where action shouldn't break BUT silent gaps
 *                    are unacceptable (Q2 resolution: silent audit gaps are worse
 *                    than silent feature failures — they look fine until a real DSR).
 *
 * Returns { ok: true } on success or { error } on soft failure.
 * The audit_events.id is NOT returned (see FU-AV2-AUDIT-EVENT-GROUPING P2 for
 * the future parent_event_id column that would need it).
 *
 * Lessons applied: #38 (assert payload shape), #44 (no abstraction layer),
 * #45 (only retrofit named sites).
 */

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditFailureMode = "throw" | "soft-warn" | "soft-sentry";

export type AuditActorType =
  | "student"
  | "teacher"
  | "fabricator"
  | "platform_admin"
  | "community_member"
  | "guardian"
  | "system";

export type AuditSeverity = "info" | "warn" | "critical";

export interface LogAuditEventInput {
  actorId: string | null;
  actorType: AuditActorType;
  impersonatedBy?: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  schoolId?: string | null;
  classId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  severity?: AuditSeverity;
  failureMode?: AuditFailureMode;
}

export type LogAuditEventResult = { ok: true } | { error: string };

export async function logAuditEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: LogAuditEventInput,
): Promise<LogAuditEventResult> {
  const failureMode = input.failureMode ?? "throw";

  // Resolve school subscription tier (denormalised analytics — losing it is
  // not catastrophic; log NULL on lookup failure rather than failing the
  // whole audit insert).
  let schoolTier: string | null = null;
  if (input.schoolId) {
    try {
      const { data } = await supabase
        .from("schools")
        .select("subscription_tier")
        .eq("id", input.schoolId)
        .maybeSingle();
      schoolTier =
        (data as { subscription_tier?: string } | null)?.subscription_tier ??
        null;
    } catch {
      schoolTier = null;
    }
  }

  try {
    const { error } = await supabase.from("audit_events").insert({
      actor_id: input.actorId,
      actor_type: input.actorType,
      impersonated_by: input.impersonatedBy ?? null,
      action: input.action,
      target_table: input.targetTable ?? null,
      target_id: input.targetId ?? null,
      school_id: input.schoolId ?? null,
      class_id: input.classId ?? null,
      payload_jsonb: input.payload ?? {},
      ip_address: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      severity: input.severity ?? "info",
      school_subscription_tier_at_event: schoolTier,
    });

    if (error) {
      return handleFailure(failureMode, error.message, input);
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return handleFailure(failureMode, message, input);
  }
}

function handleFailure(
  mode: AuditFailureMode,
  message: string,
  input: LogAuditEventInput,
): LogAuditEventResult {
  if (mode === "throw") {
    throw new Error(`[audit-log] insert failed (${input.action}): ${message}`);
  }

  if (mode === "soft-warn") {
    console.warn(
      `[audit-log] insert failed (soft-warn, ${input.action}): ${message}`,
    );
    return { error: message };
  }

  // soft-sentry — emit Sentry exception so the gap is visible even though the
  // calling action continues. Q2 resolution.
  console.warn(
    `[audit-log] insert failed (soft-sentry, ${input.action}): ${message}`,
  );
  Sentry.captureException(
    new Error(`[audit-log] insert failed (${input.action}): ${message}`),
    {
      tags: {
        layer: "audit-log",
        action: input.action,
        actor_type: input.actorType,
        severity: input.severity ?? "info",
      },
      extra: {
        schoolId: input.schoolId ?? null,
        classId: input.classId ?? null,
        targetTable: input.targetTable ?? null,
        targetId: input.targetId ?? null,
      },
    },
  );
  return { error: message };
}
