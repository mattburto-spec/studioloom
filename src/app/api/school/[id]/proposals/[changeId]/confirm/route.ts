/**
 * POST /api/school/[id]/proposals/[changeId]/confirm
 *
 * Phase 4.4c — 2nd-teacher confirms a high-stakes pending proposal.
 *
 * Flow:
 *   1. Authenticate teacher (must be same-school OR platform_admin)
 *   2. Read the change row to get change_type + payload (we need
 *      payload.after to apply, change_type to route to applier)
 *   3. Call confirmHighStakesChange (flips status='applied', sets
 *      applied_at + confirmed_by_user_id; rejects self-confirm + expired)
 *   4. If confirm succeeded, call applyChange to update the actual
 *      schools column with payload.after
 *   5. Return result
 *
 * Status mapping:
 *   200 — confirmed + applied
 *   400 — invalid id
 *   401 — unauthenticated
 *   403 — cross-school (without platform admin)
 *   404 — change_id not found
 *   409 — not_pending (already applied/reverted/expired) OR
 *         self_confirm_forbidden OR expired
 *   500 — apply_failed (proposal flipped to applied, but column write
 *         failed) OR db_error
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmHighStakesChange } from "@/lib/access-v2/governance/setting-change";
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

    // Read the change row first — we need change_type + payload to route
    // to the right applier and pass payload.after as newValue.
    const { data: changeRow, error: readErr } = await admin
      .from("school_setting_changes")
      .select("id, school_id, change_type, status, payload_jsonb")
      .eq("id", changeId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (readErr || !changeRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Confirm via governance helper. This handles self-confirm-forbidden,
    // not-pending, expired, optimistic concurrency.
    const confirmResult = await confirmHighStakesChange({
      changeId,
      confirmerUserId: auth.teacherId,
    });

    if (!confirmResult.ok) {
      const statusMap: Record<typeof confirmResult.reason, number> = {
        not_found: 404,
        not_pending: 409,
        self_confirm_forbidden: 409,
        expired: 409,
        db_error: 500,
      };
      return NextResponse.json(
        {
          ok: false,
          reason: confirmResult.reason,
          message: confirmResult.message,
        },
        {
          status: statusMap[confirmResult.reason] ?? 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    // Confirmed — now apply the actual column change with payload.after.
    const payload = changeRow.payload_jsonb as
      | { after?: unknown; scope?: Record<string, unknown> }
      | null;
    const applyResult = await applyChange({
      schoolId,
      changeType: changeRow.change_type,
      newValue: payload?.after ?? null,
      scope: payload?.scope,
    });

    if (!applyResult.ok) {
      // Confirm flipped status='applied' in the audit ledger but the
      // column update failed. Surface loudly — caller can re-apply via
      // the settings UI.
      console.error(
        "[proposals/confirm POST] applied but applier failed:",
        applyResult
      );
      return NextResponse.json(
        {
          ok: false,
          reason: "apply_failed",
          message: applyResult.message,
          changeId: confirmResult.changeId,
          appliedAt: confirmResult.appliedAt,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        changeId: confirmResult.changeId,
        appliedAt: confirmResult.appliedAt,
        rowsAffected: applyResult.rowsAffected,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[proposals/confirm POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
