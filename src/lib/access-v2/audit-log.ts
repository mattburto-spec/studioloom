/**
 * SCAFFOLD — Phase 5.1
 *
 * Wraps audit_events INSERT in a single typed entry point.
 * See docs/projects/access-model-v2-phase-5-brief.md §5.1 for full spec.
 *
 * Public surface (full implementation lands in Phase 5.1):
 *   logAuditEvent(supabase, input: LogAuditEventInput): Promise<{ id } | { error }>
 *
 * Behaviour summary:
 *   - Auto-resolves school_subscription_tier_at_event from schools.subscription_tier
 *   - Default failureMode = 'throw' (atomic with action)
 *   - 'soft-warn' for student-classcode-login (preserve auth flow)
 *   - 'soft-sentry' for non-auth retrofits (Sentry.captureException + continue)
 *
 * Retrofit targets (Phase 5.1):
 *   - src/lib/access-v2/governance/school-merge.ts (5 sites, 'throw')
 *   - src/app/api/auth/student-classcode-login/route.ts ('soft-warn')
 *   - src/app/api/admin/school/[id]/impersonate/route.ts ('soft-sentry')
 *   - src/app/api/school/[id]/changes/[changeId]/revert/route.ts ('soft-sentry')
 *   - src/app/api/school/[id]/invitations/[inviteId]/revoke/route.ts ('soft-sentry')
 *   - src/app/api/auth/accept-school-invitation/route.ts via lib/access-v2/school/invitations.ts ('soft-sentry')
 *   - src/app/api/teacher/welcome/request-school-access/route.ts ('soft-sentry')
 *   - src/lib/access-v2/can.ts:96 TODO ('soft-sentry')
 *
 * Lessons applied: #38 (assert payload shape, not non-null), #44 (no event-bus
 * abstraction), #45 (only retrofit named sites; CI gate enforces future).
 */

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

export type LogAuditEventResult = { id: string } | { error: string };

export async function logAuditEvent(
  _supabase: unknown,
  _input: LogAuditEventInput,
): Promise<LogAuditEventResult> {
  throw new Error(
    "[scaffold] logAuditEvent not implemented — see docs/projects/access-model-v2-phase-5-brief.md §5.1",
  );
}
