/**
 * dispatchIntegrityAlerts — Phase 3B consumer of the Phase 3A notifications
 * foundation.
 *
 * Called fire-and-forget from /api/student/progress POST after a successful
 * upsert that included integrityMetadata. Scores every key in the metadata,
 * and if the LOWEST score is below threshold, fires ONE notification per
 * teacher (lead_teacher + co_teacher) on the resolved class.
 *
 * Design choices:
 *   - One notification per page-day per teacher (dedup key includes
 *     student_id, page_id, YYYY-MM-DD). Multi-flagged pages collapse into
 *     one alert; the teacher clicks through to the IntegrityReport for
 *     full per-response detail.
 *   - Threshold hardcoded at 40 in Phase 3B. Phase 3E will replace with
 *     per-teacher preferences (school-default fallback).
 *   - resolvedClassId === null (multi-class ambiguity from the route's
 *     class resolution) → skip entirely. Don't fan out across classes.
 *   - co_teacher visibility comes from class_members; dept_head/mentor/
 *     observer are NOT notified in Phase 3B (would over-notify; Phase 3E
 *     preferences will let those roles opt in).
 *   - One audit event per dispatch (action='integrity.flag_auto_created'),
 *     emitted before notifications fire so the classification has its
 *     own audit row independent of the notification table.
 *
 * Lessons applied: #38 (assert exact values), #44 (one purpose, no
 * speculative dispatcher generalisation), #45 (route wiring is one
 * fire-and-forget line; logic lives here).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeIntegrity,
  type IntegrityAnalysis,
} from "@/lib/integrity/analyze-integrity";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";
import { logAuditEvent } from "@/lib/access-v2/audit-log";
import { createNotification } from "@/lib/notifications/create-notification";

/** Default flag threshold. Phase 3E will replace with per-teacher preference. */
export const DEFAULT_INTEGRITY_ALERT_THRESHOLD = 40;

/** Roles that receive integrity alerts in Phase 3B. */
const ALERT_RECIPIENT_ROLES = ["lead_teacher", "co_teacher"] as const;

export interface DispatchIntegrityAlertsArgs {
  studentId: string;
  /** student_progress.id — the row whose integrity_metadata triggered this. */
  progressRowId: string;
  unitId: string;
  pageId: string;
  /** Resolved class for this save. NULL = multi-class ambiguity → skip. */
  classId: string | null;
  /**
   * The integrity_metadata JSONB just upserted. Keyed by response key
   * (`activity_<id>` or `section_<i>`). Each value is one IntegrityMetadata.
   */
  integrityMetadata: Record<string, IntegrityMetadata>;
  /** Override threshold. Defaults to 40 (Phase 3E will inject per-teacher prefs). */
  threshold?: number;
  /** Override "now" for testability. */
  now?: Date;
}

export interface DispatchIntegrityAlertsResult {
  ok: true;
  /** Lowest score across all metadata keys. NULL if no scorable keys. */
  lowestScore: number | null;
  /** Number of teachers found in class_members for the resolved class. */
  classMembersFound: number;
  /** Number of notifications createNotification reported created (excludes deduped). */
  notificationsCreated: number;
  /** Number of notifications that were idempotent dedup hits. */
  notificationsDeduped: number;
  /** Reason notifications were skipped, if any (for debug logs). */
  skipReason?: "no_metadata" | "all_above_threshold" | "no_class_id" | "no_recipients";
}

interface KeyScore {
  responseKey: string;
  analysis: IntegrityAnalysis;
}

/**
 * Format dedup key: <studentId>|<pageId>|<YYYY-MM-DD>.
 * One notification per teacher per (student, page) per calendar day.
 */
function buildDedupKey(
  studentId: string,
  pageId: string,
  now: Date,
): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${studentId}|${pageId}|${yyyy}-${mm}-${dd}`;
}

export async function dispatchIntegrityAlerts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  args: DispatchIntegrityAlertsArgs,
): Promise<DispatchIntegrityAlertsResult> {
  const threshold = args.threshold ?? DEFAULT_INTEGRITY_ALERT_THRESHOLD;
  const now = args.now ?? new Date();

  // 1. Score every key. Skip empties.
  const scored: KeyScore[] = Object.entries(args.integrityMetadata)
    .filter(([, m]) => m && typeof m === "object")
    .map(([responseKey, m]) => ({
      responseKey,
      analysis: analyzeIntegrity(m),
    }));

  if (scored.length === 0) {
    return {
      ok: true,
      lowestScore: null,
      classMembersFound: 0,
      notificationsCreated: 0,
      notificationsDeduped: 0,
      skipReason: "no_metadata",
    };
  }

  // 2. Find lowest score; bail if everything's above threshold.
  const lowest = scored.reduce((min, cur) =>
    cur.analysis.score < min.analysis.score ? cur : min,
  );

  if (lowest.analysis.score >= threshold) {
    return {
      ok: true,
      lowestScore: lowest.analysis.score,
      classMembersFound: 0,
      notificationsCreated: 0,
      notificationsDeduped: 0,
      skipReason: "all_above_threshold",
    };
  }

  // 3. classId null = multi-class ambiguity. Skip.
  if (!args.classId) {
    return {
      ok: true,
      lowestScore: lowest.analysis.score,
      classMembersFound: 0,
      notificationsCreated: 0,
      notificationsDeduped: 0,
      skipReason: "no_class_id",
    };
  }

  // 4. Look up class members + class school_id in parallel.
  const [classRes, membersRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, school_id")
      .eq("id", args.classId)
      .maybeSingle(),
    supabase
      .from("class_members")
      .select("member_user_id, role")
      .eq("class_id", args.classId)
      .in("role", ALERT_RECIPIENT_ROLES as unknown as string[])
      .is("removed_at", null),
  ]);

  const schoolId =
    (classRes.data as { school_id: string | null } | null)?.school_id ?? null;

  const recipients =
    (membersRes.data as { member_user_id: string; role: string }[] | null) ??
    [];

  const flagCount = scored.filter(
    (s) => s.analysis.flags.length > 0,
  ).length;

  const auditPayload = {
    student_id: args.studentId,
    progress_row_id: args.progressRowId,
    unit_id: args.unitId,
    page_id: args.pageId,
    lowest_score: lowest.analysis.score,
    lowest_response_key: lowest.responseKey,
    flag_count: flagCount,
    flag_types: lowest.analysis.flags.map((f) => f.type),
    threshold,
    recipient_count: recipients.length,
  };

  // 5. Audit emission — one row per dispatch, BEFORE notifications fire.
  // Use soft-sentry: audit gaps go to Sentry but don't break the alert flow.
  void logAuditEvent(supabase, {
    actorId: null,
    actorType: "system",
    action: "integrity.flag_auto_created",
    targetTable: "student_progress",
    targetId: args.progressRowId,
    schoolId,
    classId: args.classId,
    payload: auditPayload,
    severity: "warn",
    failureMode: "soft-sentry",
  });

  if (recipients.length === 0) {
    return {
      ok: true,
      lowestScore: lowest.analysis.score,
      classMembersFound: 0,
      notificationsCreated: 0,
      notificationsDeduped: 0,
      skipReason: "no_recipients",
    };
  }

  // 6. Fan out one notification per teacher.
  const dedupKey = buildDedupKey(args.studentId, args.pageId, now);
  const score = lowest.analysis.score;
  const flagTypes = lowest.analysis.flags.map((f) => f.type);
  const otherFlaggedCount = Math.max(0, flagCount - 1);

  const title =
    score < 40
      ? "Review recommended: low writing-confidence score"
      : "Review recommended: writing-confidence flagged";

  const flagTypeSummary = flagTypes
    .map((t) => t.replace(/_/g, " "))
    .join(", ");
  const body = otherFlaggedCount > 0
    ? `Score ${score}/100. Flags: ${flagTypeSummary}. ${otherFlaggedCount} other flagged response${otherFlaggedCount === 1 ? "" : "s"} on this page.`
    : `Score ${score}/100. Flags: ${flagTypeSummary}.`;

  const linkUrl = `/teacher/classes/${args.classId}/grading/${args.unitId}`;

  let created = 0;
  let deduped = 0;

  for (const r of recipients) {
    const result = await createNotification(supabase, {
      recipientId: r.member_user_id,
      recipientRole: "teacher",
      schoolId,
      kind: "integrity.flag_low_score",
      severity: "warn",
      title,
      body,
      payload: {
        student_id: args.studentId,
        progress_row_id: args.progressRowId,
        unit_id: args.unitId,
        page_id: args.pageId,
        class_id: args.classId,
        lowest_score: score,
        lowest_response_key: lowest.responseKey,
        flag_types: flagTypes,
        other_flagged_count: otherFlaggedCount,
      },
      dedupKey,
      linkUrl,
    });

    if (result.ok) {
      if (result.deduped) deduped++;
      else created++;
    }
  }

  return {
    ok: true,
    lowestScore: score,
    classMembersFound: recipients.length,
    notificationsCreated: created,
    notificationsDeduped: deduped,
  };
}
