/**
 * POST /api/admin/school/[id]/merge-requests/[mergeId]/approve
 *
 * Phase 4.5 — platform admin approves a pending merge request. Runs the
 * cascade across 15 tables, flips the from-school to status='merged_into'
 * with merged_into_id set, and emits one audit_events row per table
 * touched (per §3.9 item 15) plus a summary row.
 *
 * Auth: platform admin only (is_platform_admin=true on user_profiles).
 *
 * Status mapping:
 *   200 — cascade succeeded (returns row counts per table)
 *   400 — invalid id
 *   401 — unauthenticated
 *   403 — not platform admin
 *   404 — merge_id not found, or [id] doesn't match either side of the merge
 *   409 — wrong status (already approved/rejected/completed)
 *   500 — cascade_failed (partial — some tables updated; see audit log)
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.5.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveMergeRequest } from "@/lib/access-v2/governance/school-merge";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string; mergeId: string }> };

async function requirePlatformAdmin(
  request: NextRequest
): Promise<{ adminId: string } | { error: NextResponse }> {
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
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_platform_admin !== true) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { adminId: user.id };
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePlatformAdmin(request);
    if ("error" in auth) return auth.error;

    const { id: schoolId, mergeId } = await ctx.params;
    if (!UUID_RE.test(schoolId) || !UUID_RE.test(mergeId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // Confirm the merge actually involves [id] before authorizing approval.
    // Mismatch → 404 (not 403 — don't leak existence of the merge).
    const admin = createAdminClient();
    const { data: existsCheck } = await admin
      .from("school_merge_requests")
      .select("id")
      .eq("id", mergeId)
      .or(`from_school_id.eq.${schoolId},into_school_id.eq.${schoolId}`)
      .maybeSingle();
    if (!existsCheck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await approveMergeRequest({
      mergeId,
      approverId: auth.adminId,
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        not_authorized: 403,
        merge_not_found: 404,
        wrong_status: 409,
        cascade_failed: 500,
      };
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          message: result.message,
          partial_cascade: result.partialCascade,
        },
        {
          status: statusMap[result.reason] ?? 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        merge_id: result.mergeId,
        cascade_row_counts: result.cascadeRowCounts,
        total_rows_updated: result.totalRowsUpdated,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[admin/merge-requests/approve POST] unexpected:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
