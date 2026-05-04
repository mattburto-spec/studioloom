/**
 * Unit-use request helpers — Phase 4.6 (school library moat).
 *
 * Colleague-to-colleague unit-share request flow. Requester (teacher A)
 * asks author (teacher B) for permission to use unit X. On approval, A
 * gets a fork with attribution preserved (units.forked_from points at
 * source unit; units.forked_from_author_id at original author).
 *
 * Public functions:
 *   requestUse({unitId, requesterUserId, intentMessage})
 *   approveRequest({requestId, authorUserId, response?})
 *   denyRequest({requestId, authorUserId, response?})
 *   withdrawRequest({requestId, requesterUserId})
 *
 * Tier-aware membership note: the library + request flow are implicitly
 * tier-appropriate via the existing school_id filter — free/pro
 * teachers are alone in personal schools so library = own units, no
 * cross-teacher requests possible. School-tier teachers share with
 * colleagues. No explicit tier-gate needed at the helper layer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "../audit-log";

export type RequestUseArgs = {
  unitId: string;
  requesterUserId: string;
  intentMessage?: string;
  supabase?: SupabaseClient;
};

export type RequestUseResult =
  | { ok: true; requestId: string }
  | {
      ok: false;
      reason:
        | "unit_not_found"
        | "unit_not_published"
        | "self_request"
        | "cross_school"
        | "duplicate_pending"
        | "requester_no_school"
        | "db_error";
      message: string;
    };

export async function requestUse(
  args: RequestUseArgs
): Promise<RequestUseResult> {
  const db = args.supabase ?? createAdminClient();

  // 1. Look up the unit + its author + school
  const { data: unit, error: unitErr } = await db
    .from("units")
    .select("id, author_teacher_id, school_id, is_published")
    .eq("id", args.unitId)
    .maybeSingle();
  if (unitErr) {
    return { ok: false, reason: "db_error", message: unitErr.message };
  }
  if (!unit) {
    return {
      ok: false,
      reason: "unit_not_found",
      message: `Unit ${args.unitId} not found`,
    };
  }
  if (!unit.is_published) {
    return {
      ok: false,
      reason: "unit_not_published",
      message:
        "This unit is not published; the author hasn't shared it to the school library",
    };
  }
  if (unit.author_teacher_id === args.requesterUserId) {
    return {
      ok: false,
      reason: "self_request",
      message: "You can't request your own unit",
    };
  }

  // 2. Look up the requester's school + verify it matches the unit's
  const { data: requester, error: requesterErr } = await db
    .from("teachers")
    .select("school_id")
    .eq("id", args.requesterUserId)
    .maybeSingle();
  if (requesterErr) {
    return { ok: false, reason: "db_error", message: requesterErr.message };
  }
  if (!requester?.school_id) {
    return {
      ok: false,
      reason: "requester_no_school",
      message: "You must be attached to a school to request unit use",
    };
  }
  if (requester.school_id !== unit.school_id) {
    return {
      ok: false,
      reason: "cross_school",
      message:
        "Cross-school requests are not allowed. The library is school-scoped.",
    };
  }

  // 3. Insert
  const { data: row, error: insertErr } = await db
    .from("unit_use_requests")
    .insert({
      unit_id: args.unitId,
      requester_user_id: args.requesterUserId,
      author_user_id: unit.author_teacher_id,
      school_id: unit.school_id,
      intent_message: args.intentMessage?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return {
        ok: false,
        reason: "duplicate_pending",
        message: "You already have a pending request for this unit",
      };
    }
    return { ok: false, reason: "db_error", message: insertErr.message };
  }

  return { ok: true, requestId: row.id };
}

// ─────────────────────────────────────────────────────────────────────
// approveRequest — creates a fork for the requester
// ─────────────────────────────────────────────────────────────────────

export type ApproveRequestArgs = {
  requestId: string;
  authorUserId: string;
  response?: string;
  supabase?: SupabaseClient;
};

export type ApproveRequestResult =
  | {
      ok: true;
      requestId: string;
      forkedUnitId: string;
    }
  | {
      ok: false;
      reason:
        | "request_not_found"
        | "not_authorized"
        | "wrong_status"
        | "fork_failed"
        | "db_error";
      message: string;
    };

export async function approveRequest(
  args: ApproveRequestArgs
): Promise<ApproveRequestResult> {
  const db = args.supabase ?? createAdminClient();

  // 1. Load + validate the request
  const { data: req, error: loadErr } = await db
    .from("unit_use_requests")
    .select(
      "id, unit_id, requester_user_id, author_user_id, school_id, status"
    )
    .eq("id", args.requestId)
    .maybeSingle();
  if (loadErr) {
    return { ok: false, reason: "db_error", message: loadErr.message };
  }
  if (!req) {
    return {
      ok: false,
      reason: "request_not_found",
      message: `Request ${args.requestId} not found`,
    };
  }
  if (req.author_user_id !== args.authorUserId) {
    return {
      ok: false,
      reason: "not_authorized",
      message: "Only the unit's author can approve this request",
    };
  }
  if (req.status !== "pending") {
    return {
      ok: false,
      reason: "wrong_status",
      message: `Request is in '${req.status}' status; only 'pending' can be approved`,
    };
  }

  // 2. Flip to approved (without forked_unit_id yet — we set it after fork)
  const { error: flipErr } = await db
    .from("unit_use_requests")
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by_user_id: args.authorUserId,
      author_response: args.response?.trim() || null,
    })
    .eq("id", args.requestId);
  if (flipErr) {
    return { ok: false, reason: "db_error", message: flipErr.message };
  }

  // 3. Fork the source unit for the requester
  const { data: source, error: sourceErr } = await db
    .from("units")
    .select(
      "id, title, description, content_data, thumbnail_url, grade_level, duration_weeks, topic, global_context, key_concept, tags, fork_count, author_teacher_id"
    )
    .eq("id", req.unit_id)
    .maybeSingle();
  if (sourceErr || !source) {
    return {
      ok: false,
      reason: "fork_failed",
      message: `Source unit lookup failed: ${sourceErr?.message ?? "not found"}`,
    };
  }

  const { data: newUnit, error: forkErr } = await db
    .from("units")
    .insert({
      title: source.title,
      description: source.description,
      content_data: source.content_data,
      thumbnail_url: source.thumbnail_url,
      is_published: false,
      school_id: req.school_id,
      author_teacher_id: req.requester_user_id,
      grade_level: source.grade_level,
      duration_weeks: source.duration_weeks,
      topic: source.topic,
      global_context: source.global_context,
      key_concept: source.key_concept,
      tags: source.tags,
      forked_from: source.id,
      forked_from_author_id: source.author_teacher_id,
    })
    .select("id")
    .single();

  if (forkErr || !newUnit) {
    // Rollback the approval flip so a retry is possible
    await db
      .from("unit_use_requests")
      .update({
        status: "pending",
        decided_at: null,
        decided_by_user_id: null,
        author_response: null,
      })
      .eq("id", args.requestId);
    return {
      ok: false,
      reason: "fork_failed",
      message: `Fork insert failed: ${forkErr?.message ?? "unknown"}`,
    };
  }

  // 4. Increment fork_count on source (non-critical)
  await db
    .from("units")
    .update({ fork_count: (source.fork_count ?? 0) + 1 })
    .eq("id", source.id);

  // 5. Backfill forked_unit_id on the request
  await db
    .from("unit_use_requests")
    .update({ forked_unit_id: newUnit.id })
    .eq("id", args.requestId);

  // 6. Audit row — failureMode 'soft-sentry': fork already created, request
  // already updated; audit hiccup must not undo the share, but the gap is
  // forensically important so Sentry captures it.
  await logAuditEvent(db, {
    actorId: args.authorUserId,
    actorType: "teacher",
    action: "unit_use_request.approved",
    targetTable: "unit_use_requests",
    targetId: args.requestId,
    schoolId: req.school_id,
    severity: "info",
    payload: {
      request_id: args.requestId,
      source_unit_id: req.unit_id,
      forked_unit_id: newUnit.id,
      requester: req.requester_user_id,
    },
    failureMode: "soft-sentry",
  });

  return { ok: true, requestId: args.requestId, forkedUnitId: newUnit.id };
}

// ─────────────────────────────────────────────────────────────────────
// denyRequest
// ─────────────────────────────────────────────────────────────────────

export type DenyRequestArgs = {
  requestId: string;
  authorUserId: string;
  response?: string;
  supabase?: SupabaseClient;
};

export type DenyRequestResult =
  | { ok: true; requestId: string }
  | {
      ok: false;
      reason:
        | "request_not_found"
        | "not_authorized"
        | "wrong_status"
        | "db_error";
      message: string;
    };

export async function denyRequest(
  args: DenyRequestArgs
): Promise<DenyRequestResult> {
  const db = args.supabase ?? createAdminClient();

  const { data: req } = await db
    .from("unit_use_requests")
    .select("id, author_user_id, school_id, status")
    .eq("id", args.requestId)
    .maybeSingle();
  if (!req) {
    return {
      ok: false,
      reason: "request_not_found",
      message: `Request ${args.requestId} not found`,
    };
  }
  if (req.author_user_id !== args.authorUserId) {
    return {
      ok: false,
      reason: "not_authorized",
      message: "Only the unit's author can deny this request",
    };
  }
  if (req.status !== "pending") {
    return {
      ok: false,
      reason: "wrong_status",
      message: `Request is in '${req.status}' status; only 'pending' can be denied`,
    };
  }

  const { error: updErr } = await db
    .from("unit_use_requests")
    .update({
      status: "denied",
      decided_at: new Date().toISOString(),
      decided_by_user_id: args.authorUserId,
      author_response: args.response?.trim() || null,
    })
    .eq("id", args.requestId);
  if (updErr) {
    return { ok: false, reason: "db_error", message: updErr.message };
  }

  // failureMode 'soft-sentry': deny status already written; audit hiccup
  // must not block the response.
  await logAuditEvent(db, {
    actorId: args.authorUserId,
    actorType: "teacher",
    action: "unit_use_request.denied",
    targetTable: "unit_use_requests",
    targetId: args.requestId,
    schoolId: req.school_id,
    severity: "info",
    payload: {
      request_id: args.requestId,
      response_provided: !!args.response,
    },
    failureMode: "soft-sentry",
  });

  return { ok: true, requestId: args.requestId };
}

// ─────────────────────────────────────────────────────────────────────
// withdrawRequest — requester cancels their own pending request
// ─────────────────────────────────────────────────────────────────────

export type WithdrawRequestArgs = {
  requestId: string;
  requesterUserId: string;
  supabase?: SupabaseClient;
};

export type WithdrawRequestResult =
  | { ok: true; requestId: string }
  | {
      ok: false;
      reason:
        | "request_not_found"
        | "not_authorized"
        | "wrong_status"
        | "db_error";
      message: string;
    };

export async function withdrawRequest(
  args: WithdrawRequestArgs
): Promise<WithdrawRequestResult> {
  const db = args.supabase ?? createAdminClient();

  const { data: req } = await db
    .from("unit_use_requests")
    .select("id, requester_user_id, school_id, status")
    .eq("id", args.requestId)
    .maybeSingle();
  if (!req) {
    return {
      ok: false,
      reason: "request_not_found",
      message: `Request ${args.requestId} not found`,
    };
  }
  if (req.requester_user_id !== args.requesterUserId) {
    return {
      ok: false,
      reason: "not_authorized",
      message: "Only the requester can withdraw their own request",
    };
  }
  if (req.status !== "pending") {
    return {
      ok: false,
      reason: "wrong_status",
      message: `Request is in '${req.status}' status; only 'pending' can be withdrawn`,
    };
  }

  const { error: updErr } = await db
    .from("unit_use_requests")
    .update({
      status: "withdrawn",
      decided_at: new Date().toISOString(),
      decided_by_user_id: args.requesterUserId,
    })
    .eq("id", args.requestId);
  if (updErr) {
    return { ok: false, reason: "db_error", message: updErr.message };
  }

  return { ok: true, requestId: args.requestId };
}
