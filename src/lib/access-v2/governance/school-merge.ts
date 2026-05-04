/**
 * School-merge governance helper — Phase 4.5.
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.5.
 *
 * Three public functions + one resolver:
 *   proposeMergeRequest()   — same-school teacher OR platform admin proposes
 *   approveMergeRequest()   — platform admin only; runs cascade
 *   rejectMergeRequest()    — platform admin only; terminal state
 *   resolveSchoolId()       — follow merged_into_id chain (max 5 hops)
 *
 * Cascade list (audited 3 May 2026 — 15 tables, NOT 12 as brief stated;
 * Lesson #54 in action — brief was paper enumeration, audit caught the
 * Preflight surfaces + guardians):
 *
 *   1. teachers              (mig 085)
 *   2. classes               (mig 117)
 *   3. students              (mig 20260428134250)
 *   4. units                 (mig 20260428134250)
 *   5. fabricators           (mig 116)
 *   6. machine_profiles      (mig 093)
 *   7. fabrication_jobs      (mig 095)
 *   8. fabrication_labs      (mig 20260427134953)
 *   9. school_resources      (mig 20260428214009)
 *  10. guardians             (mig 20260428214009)
 *  11. school_responsibilities (mig 20260428214735)
 *  12. student_mentors        (mig 20260428214735)
 *  13. audit_events           (mig 20260428215923)
 *  14. school_domains         (mig 20260502031121)
 *  15. school_setting_changes (mig 20260502034114)
 *
 * Tables intentionally NOT in cascade (transitively follow via FK chains):
 *   - class_members            (joins via class_id → classes.school_id)
 *   - consents                 (joins via subject_id → teacher/student/guardian)
 *   - school_setting_changes_rate_state (per-actor, no school_id)
 *   - school_merge_requests    (this table itself; merge can't reference its own merge)
 *
 * Audit-events immutability tension: mig 20260428215923 documents
 * audit_events as INSERT-only / no UPDATE policy. Updating its school_id
 * during cascade is a deliberate exception — the cascade is metadata
 * correction by platform admin (not actor manipulation). The cascade
 * UPDATE goes through service role so RLS doesn't apply. We log a
 * `school_merge_cascade_table` audit_events row PER TABLE TOUCHED
 * (15 rows + 1 summary `school_merge_completed` row = 16 audit rows
 * per merge approval) so the forensic trail is preserved.
 *
 * Per §3.9 item 15.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceArchivedReadOnly } from "../school/archived-guard";
import { logAuditEvent } from "../audit-log";

// ─────────────────────────────────────────────────────────────────────
// Cascade table list
// ─────────────────────────────────────────────────────────────────────

/**
 * Tables that have a direct `school_id` FK to schools(id) and must be
 * cascade-rewritten on merge approval. Order is not load-bearing — each
 * row update is independent. Audit logs capture per-table row counts.
 */
export const CASCADE_TABLES: ReadonlyArray<string> = Object.freeze([
  "teachers",
  "classes",
  "students",
  "units",
  "fabricators",
  "machine_profiles",
  "fabrication_jobs",
  "fabrication_labs",
  "school_resources",
  "guardians",
  "school_responsibilities",
  "student_mentors",
  "audit_events",
  "school_domains",
  "school_setting_changes",
]);

const MAX_RESOLVE_DEPTH = 5;

// ─────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────

export type ProposeMergeResult =
  | { ok: true; mergeId: string }
  | {
      ok: false;
      reason:
        | "same_school"
        | "archived"
        | "duplicate_pending"
        | "not_authorized"
        | "school_not_found"
        | "db_error";
      message: string;
    };

export type ApproveMergeResult =
  | {
      ok: true;
      mergeId: string;
      cascadeRowCounts: Record<string, number>;
      totalRowsUpdated: number;
    }
  | {
      ok: false;
      reason:
        | "not_authorized"
        | "merge_not_found"
        | "wrong_status"
        | "cascade_failed";
      message: string;
      partialCascade?: Record<string, number>;
    };

export type RejectMergeResult =
  | { ok: true; mergeId: string }
  | {
      ok: false;
      reason: "not_authorized" | "merge_not_found" | "wrong_status";
      message: string;
    };

export type ResolveSchoolIdResult =
  | { ok: true; resolvedId: string; hops: number }
  | { ok: false; reason: "cycle_detected" | "max_depth_exceeded"; message: string };

// ─────────────────────────────────────────────────────────────────────
// proposeMergeRequest
// ─────────────────────────────────────────────────────────────────────

export async function proposeMergeRequest(args: {
  fromSchoolId: string;
  intoSchoolId: string;
  requesterId: string;
  reason: string;
  supabase?: SupabaseClient;
}): Promise<ProposeMergeResult> {
  const { fromSchoolId, intoSchoolId, requesterId, reason } = args;

  if (fromSchoolId === intoSchoolId) {
    return {
      ok: false,
      reason: "same_school",
      message: "from_school_id and into_school_id must differ",
    };
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length === 0) {
    return {
      ok: false,
      reason: "db_error",
      message: "reason is required",
    };
  }

  const db = args.supabase ?? createAdminClient();

  // Authorization: requester must be a teacher in EITHER school OR a platform admin.
  const { data: profile, error: profileErr } = await db
    .from("user_profiles")
    .select("is_platform_admin")
    .eq("id", requesterId)
    .maybeSingle();
  if (profileErr) {
    return { ok: false, reason: "db_error", message: profileErr.message };
  }
  const isPlatformAdmin = profile?.is_platform_admin === true;

  if (!isPlatformAdmin) {
    const { data: teacher, error: teacherErr } = await db
      .from("teachers")
      .select("school_id")
      .eq("id", requesterId)
      .maybeSingle();
    if (teacherErr) {
      return { ok: false, reason: "db_error", message: teacherErr.message };
    }
    if (
      !teacher?.school_id ||
      (teacher.school_id !== fromSchoolId && teacher.school_id !== intoSchoolId)
    ) {
      return {
        ok: false,
        reason: "not_authorized",
        message:
          "Only same-school teachers (either side) or platform admin can propose a merge",
      };
    }
  }

  // Archived-guard: neither side may be in a read-only status (archived
  // or merged_into). enforceArchivedReadOnly returns readOnly:true to block.
  const fromGuard = await enforceArchivedReadOnly(fromSchoolId, db);
  if (fromGuard.readOnly) {
    return {
      ok: false,
      reason: "archived",
      message: `from_school is read-only (${fromGuard.status ?? "unknown"}): ${fromGuard.reason}`,
    };
  }
  const intoGuard = await enforceArchivedReadOnly(intoSchoolId, db);
  if (intoGuard.readOnly) {
    return {
      ok: false,
      reason: "archived",
      message: `into_school is read-only (${intoGuard.status ?? "unknown"}): ${intoGuard.reason}`,
    };
  }

  // Insert — uniqueness on (from, into) WHERE status='pending' is enforced
  // by partial unique index idx_smr_unique_pending. Catch 23505.
  const { data: row, error: insertErr } = await db
    .from("school_merge_requests")
    .insert({
      from_school_id: fromSchoolId,
      into_school_id: intoSchoolId,
      requested_by_user_id: requesterId,
      reason: trimmedReason,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return {
        ok: false,
        reason: "duplicate_pending",
        message: "A pending merge request already exists for this pair",
      };
    }
    if (insertErr.code === "23503") {
      return {
        ok: false,
        reason: "school_not_found",
        message: "from_school or into_school does not exist",
      };
    }
    return { ok: false, reason: "db_error", message: insertErr.message };
  }

  return { ok: true, mergeId: row.id };
}

// ─────────────────────────────────────────────────────────────────────
// approveMergeRequest
// ─────────────────────────────────────────────────────────────────────

export async function approveMergeRequest(args: {
  mergeId: string;
  approverId: string;
  supabase?: SupabaseClient;
}): Promise<ApproveMergeResult> {
  const { mergeId, approverId } = args;
  const db = args.supabase ?? createAdminClient();

  // 1. Authorization: must be platform admin
  const { data: profile, error: profileErr } = await db
    .from("user_profiles")
    .select("is_platform_admin")
    .eq("id", approverId)
    .maybeSingle();
  if (profileErr) {
    return {
      ok: false,
      reason: "not_authorized",
      message: `Could not verify approver: ${profileErr.message}`,
    };
  }
  if (profile?.is_platform_admin !== true) {
    return {
      ok: false,
      reason: "not_authorized",
      message: "Only platform admin can approve a merge",
    };
  }

  // 2. Load + validate the request is pending
  const { data: request, error: loadErr } = await db
    .from("school_merge_requests")
    .select("id, from_school_id, into_school_id, status")
    .eq("id", mergeId)
    .maybeSingle();
  if (loadErr) {
    return { ok: false, reason: "merge_not_found", message: loadErr.message };
  }
  if (!request) {
    return {
      ok: false,
      reason: "merge_not_found",
      message: `Merge request ${mergeId} not found`,
    };
  }
  if (request.status !== "pending") {
    return {
      ok: false,
      reason: "wrong_status",
      message: `Merge request is in '${request.status}' status; only 'pending' can be approved`,
    };
  }

  const fromId = request.from_school_id;
  const intoId = request.into_school_id;

  // 3. Flip status to 'approved' (sets approved_at via the helper SET below)
  const { error: flipErr } = await db
    .from("school_merge_requests")
    .update({
      status: "approved",
      approved_by_user_id: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", mergeId);
  if (flipErr) {
    return {
      ok: false,
      reason: "cascade_failed",
      message: `Could not flip to approved: ${flipErr.message}`,
    };
  }

  // 4. Cascade: UPDATE every CASCADE_TABLE row WHERE school_id = fromId
  //    SET school_id = intoId. Track row counts per table.
  const cascadeRowCounts: Record<string, number> = {};
  const partialCascade: Record<string, number> = {};
  let totalRowsUpdated = 0;

  for (const table of CASCADE_TABLES) {
    const { error: updateErr, count } = await db
      .from(table)
      .update({ school_id: intoId }, { count: "exact" })
      .eq("school_id", fromId);

    if (updateErr) {
      // Stop on first error. Row stays at 'approved' status — completed_at
      // not set — partial cascade requires manual intervention or retry.
      // Log a failure audit row. failureMode 'throw' — cascade integrity is
      // non-negotiable; if we can't audit the failure we surface it loudly.
      await logAuditEvent(db, {
        actorId: approverId,
        actorType: "platform_admin",
        action: "school_merge_cascade_failed",
        targetTable: table,
        schoolId: intoId,
        payload: {
          merge_request_id: mergeId,
          from_school_id: fromId,
          into_school_id: intoId,
          failed_table: table,
          error: updateErr.message,
          partial_row_counts: cascadeRowCounts,
        },
        severity: "critical",
        failureMode: "throw",
      });

      return {
        ok: false,
        reason: "cascade_failed",
        message: `Cascade UPDATE failed on ${table}: ${updateErr.message}`,
        partialCascade: cascadeRowCounts,
      };
    }

    const rowsUpdated = count ?? 0;
    cascadeRowCounts[table] = rowsUpdated;
    partialCascade[table] = rowsUpdated;
    totalRowsUpdated += rowsUpdated;

    // Per §3.9 item 15 — one audit row per table touched
    await logAuditEvent(db, {
      actorId: approverId,
      actorType: "platform_admin",
      action: "school_merge_cascade_table",
      targetTable: table,
      schoolId: intoId,
      payload: {
        merge_request_id: mergeId,
        from_school_id: fromId,
        into_school_id: intoId,
        table_name: table,
        rows_updated: rowsUpdated,
      },
      severity: "info",
      failureMode: "throw",
    });
  }

  // 5. Mark from-school as merged_into; flip its status; set merged_into_id
  const { error: schoolFlipErr } = await db
    .from("schools")
    .update({
      status: "merged_into",
      merged_into_id: intoId,
    })
    .eq("id", fromId);
  if (schoolFlipErr) {
    await logAuditEvent(db, {
      actorId: approverId,
      actorType: "platform_admin",
      action: "school_merge_school_flip_failed",
      targetTable: "schools",
      targetId: fromId,
      schoolId: intoId,
      payload: {
        merge_request_id: mergeId,
        error: schoolFlipErr.message,
        cascade_completed: cascadeRowCounts,
      },
      severity: "critical",
      failureMode: "throw",
    });
    return {
      ok: false,
      reason: "cascade_failed",
      message: `School flip failed after cascade: ${schoolFlipErr.message}`,
      partialCascade: cascadeRowCounts,
    };
  }

  // 6. Mark merge request as completed
  const { error: completeErr } = await db
    .from("school_merge_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", mergeId);
  if (completeErr) {
    return {
      ok: false,
      reason: "cascade_failed",
      message: `Cascade succeeded but completion flag failed: ${completeErr.message}`,
      partialCascade: cascadeRowCounts,
    };
  }

  // 7. Summary audit row — one per merge
  await logAuditEvent(db, {
    actorId: approverId,
    actorType: "platform_admin",
    action: "school_merge_completed",
    targetTable: "school_merge_requests",
    targetId: mergeId,
    schoolId: intoId,
    payload: {
      merge_request_id: mergeId,
      from_school_id: fromId,
      into_school_id: intoId,
      total_rows_updated: totalRowsUpdated,
      per_table_row_counts: cascadeRowCounts,
    },
    severity: "info",
    failureMode: "throw",
  });

  return {
    ok: true,
    mergeId,
    cascadeRowCounts,
    totalRowsUpdated,
  };
}

// ─────────────────────────────────────────────────────────────────────
// rejectMergeRequest
// ─────────────────────────────────────────────────────────────────────

export async function rejectMergeRequest(args: {
  mergeId: string;
  approverId: string;
  rejectionReason?: string;
  supabase?: SupabaseClient;
}): Promise<RejectMergeResult> {
  const { mergeId, approverId, rejectionReason } = args;
  const db = args.supabase ?? createAdminClient();

  // 1. Auth
  const { data: profile } = await db
    .from("user_profiles")
    .select("is_platform_admin")
    .eq("id", approverId)
    .maybeSingle();
  if (profile?.is_platform_admin !== true) {
    return {
      ok: false,
      reason: "not_authorized",
      message: "Only platform admin can reject a merge",
    };
  }

  // 2. Load + validate
  const { data: request } = await db
    .from("school_merge_requests")
    .select("id, status")
    .eq("id", mergeId)
    .maybeSingle();
  if (!request) {
    return {
      ok: false,
      reason: "merge_not_found",
      message: `Merge request ${mergeId} not found`,
    };
  }
  if (request.status !== "pending") {
    return {
      ok: false,
      reason: "wrong_status",
      message: `Merge request is in '${request.status}' status; only 'pending' can be rejected`,
    };
  }

  // 3. Flip
  const { error: rejectErr } = await db
    .from("school_merge_requests")
    .update({
      status: "rejected",
      approved_by_user_id: approverId,
      rejected_at: new Date().toISOString(),
      rejection_reason: rejectionReason?.trim() || null,
    })
    .eq("id", mergeId);

  if (rejectErr) {
    return {
      ok: false,
      reason: "merge_not_found",
      message: `Reject flip failed: ${rejectErr.message}`,
    };
  }

  // 4. Audit row
  await logAuditEvent(db, {
    actorId: approverId,
    actorType: "platform_admin",
    action: "school_merge_rejected",
    targetTable: "school_merge_requests",
    targetId: mergeId,
    payload: {
      merge_request_id: mergeId,
      rejection_reason: rejectionReason ?? null,
    },
    severity: "info",
    failureMode: "throw",
  });

  return { ok: true, mergeId };
}

// ─────────────────────────────────────────────────────────────────────
// resolveSchoolId — follow merged_into_id chain
// ─────────────────────────────────────────────────────────────────────

/**
 * If schoolId points at a school that has been merged into another, return
 * the surviving school id. Follows the chain up to MAX_RESOLVE_DEPTH (5)
 * hops. Throws on cycle detection. Returns the input id if no merge has
 * happened.
 *
 * Routes call this BEFORE filtering by school_id when handling URLs that
 * may carry a stale (merged-in) school_id. NOT middleware-injected — each
 * route opts in explicitly to avoid cache-poisoning surprises.
 */
export async function resolveSchoolId(
  schoolId: string,
  supabase?: SupabaseClient
): Promise<ResolveSchoolIdResult> {
  const db = supabase ?? createAdminClient();
  const visited = new Set<string>();
  let current = schoolId;
  let hops = 0;

  while (hops < MAX_RESOLVE_DEPTH) {
    if (visited.has(current)) {
      return {
        ok: false,
        reason: "cycle_detected",
        message: `Cycle detected at ${current}; chain so far: ${[...visited].join(" → ")}`,
      };
    }
    visited.add(current);

    const { data, error } = await db
      .from("schools")
      .select("merged_into_id")
      .eq("id", current)
      .maybeSingle();
    if (error) {
      // On DB error, return the input ID — caller proceeds as-if no merge
      // happened. This is safer than throwing in the read path.
      return { ok: true, resolvedId: schoolId, hops: 0 };
    }
    if (!data?.merged_into_id) {
      return { ok: true, resolvedId: current, hops };
    }
    current = data.merged_into_id;
    hops += 1;
  }

  return {
    ok: false,
    reason: "max_depth_exceeded",
    message: `Chain exceeded ${MAX_RESOLVE_DEPTH} hops starting from ${schoolId}`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Test-only exports
// ─────────────────────────────────────────────────────────────────────

export const __TEST__ = {
  CASCADE_TABLES,
  MAX_RESOLVE_DEPTH,
};
