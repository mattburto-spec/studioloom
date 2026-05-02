/**
 * POST /api/school/[id]/changes/[changeId]/revert
 *
 * Phase 4.4c — same-school teacher reverts an applied low-stakes change
 * within the 7-day window. The revert writes `payload.before_at_propose`
 * back to the schools column AND flips the change row's status to
 * 'reverted' (audit trail preserved).
 *
 * Flow:
 *   1. Authenticate teacher
 *   2. Read change row (need change_type + payload.before_at_propose +
 *      payload.scope to route applier correctly)
 *   3. Call revertChange (governance helper) — flips status='reverted',
 *      sets reverted_at + reverted_by_user_id; rejects not-applied,
 *      outside-revert-window
 *   4. If revert succeeded, call applyChange with payload.before_at_propose
 *      as newValue — writes the original value back
 *   5. Return result
 *
 * Status mapping:
 *   200 — reverted + applied (original value restored)
 *   400 — invalid id
 *   401 — unauthenticated
 *   404 — change_id not found OR cross-school
 *   409 — not_applied (status is pending/reverted/expired) OR
 *         outside_revert_window (older than 7 days)
 *   500 — apply_failed OR db_error
 *
 * Note on revert semantics for high-stakes changes: the brief restricts
 * revert to applied changes within 7 days (same window for both tiers).
 * Reverting a previously-confirmed high-stakes change is allowed within
 * 7 days — same path. The 2-teacher consensus is for the original
 * proposal; revert is intended as a "we changed our minds" or "this
 * was a mistake" escape hatch.
 *
 * Edge case for governance: should reverts themselves require 2-teacher
 * confirm? Per master spec §8.3 line 393 — "every change (low or high
 * tier) emits an audit_events row". Revert is a CHANGE itself in the
 * audit sense. For Phase 4.4c we ship single-teacher revert (matches
 * master spec line 391). If pilot reveals abuse (rogue teacher reverts
 * everyone else's changes), we tighten in a follow-up.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { revertChange } from "@/lib/access-v2/governance/setting-change";
import { applyChange } from "@/lib/access-v2/governance/applier";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string; changeId: string }> };

async function authenticateTeacher(request: NextRequest): Promise<
  | {
      teacherId: string;
      schoolId: string | null;
      isPlatformAdmin: boolean;
    }
  | { error: NextResponse }
> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const admin = createAdminClient();
  const [{ data: teacher }, { data: profile }] = await Promise.all([
    admin
      .from("teachers")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  return {
    teacherId: user.id,
    schoolId: teacher?.school_id ?? null,
    isPlatformAdmin: profile?.is_platform_admin === true,
  };
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await authenticateTeacher(request);
    if ("error" in auth) return auth.error;

    const { id: schoolId, changeId } = await ctx.params;

    if (!UUID_RE.test(schoolId) || !UUID_RE.test(changeId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    if (auth.schoolId !== schoolId && !auth.isPlatformAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admin = createAdminClient();

    // Read the change row to get the historical before_at_propose value
    // — this is what we'll write back to the column.
    const { data: changeRow, error: readErr } = await admin
      .from("school_setting_changes")
      .select("id, school_id, change_type, status, payload_jsonb")
      .eq("id", changeId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (readErr || !changeRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const revertResult = await revertChange({
      changeId,
      reverterUserId: auth.teacherId,
    });

    if (!revertResult.ok) {
      const statusMap: Record<typeof revertResult.reason, number> = {
        not_found: 404,
        not_applied: 409,
        outside_revert_window: 409,
        db_error: 500,
      };
      return NextResponse.json(
        {
          ok: false,
          reason: revertResult.reason,
          message: revertResult.message,
        },
        {
          status: statusMap[revertResult.reason] ?? 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    // Revert succeeded — write the historical before_at_propose value back
    // to the column. PayloadV1 always carries this; if it's missing we
    // surface the issue rather than silently no-op.
    const payload = changeRow.payload_jsonb as
      | { before_at_propose?: unknown; scope?: Record<string, unknown> }
      | null;

    if (payload?.before_at_propose === undefined) {
      console.error(
        "[changes/revert POST] revert succeeded but payload missing before_at_propose:",
        { changeId, payload }
      );
      return NextResponse.json(
        {
          ok: false,
          reason: "missing_before_value",
          message:
            "Revert recorded but original value missing from audit payload.",
          changeId: revertResult.changeId,
          revertedAt: revertResult.revertedAt,
        },
        { status: 500 }
      );
    }

    const applyResult = await applyChange({
      schoolId,
      changeType: changeRow.change_type,
      newValue: payload.before_at_propose,
      scope: payload.scope,
    });

    if (!applyResult.ok) {
      console.error(
        "[changes/revert POST] reverted but applier failed:",
        applyResult
      );
      return NextResponse.json(
        {
          ok: false,
          reason: "apply_failed",
          message: applyResult.message,
          changeId: revertResult.changeId,
          revertedAt: revertResult.revertedAt,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        changeId: revertResult.changeId,
        revertedAt: revertResult.revertedAt,
        rowsAffected: applyResult.rowsAffected,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[changes/revert POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
