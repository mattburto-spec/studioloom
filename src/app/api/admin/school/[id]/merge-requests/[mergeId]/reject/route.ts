/**
 * POST /api/admin/school/[id]/merge-requests/[mergeId]/reject
 *
 * Phase 4.5 — platform admin rejects a pending merge request. Terminal
 * state; no cascade. Audit row logged.
 *
 * Auth: platform admin only.
 *
 * Request body (optional):
 *   { rejection_reason?: string }
 *
 * Status mapping:
 *   200 — rejected
 *   400 — invalid id / payload
 *   401 — unauthenticated
 *   403 — not platform admin
 *   404 — merge_id not found OR [id] doesn't match either side
 *   409 — wrong status (not pending)
 *   500 — db_error
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.5 (lifecycle).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectMergeRequest } from "@/lib/access-v2/governance/school-merge";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON_LENGTH = 1000;

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

    let body: { rejection_reason?: unknown } = {};
    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rejectionReason =
      typeof body.rejection_reason === "string"
        ? body.rejection_reason
        : undefined;
    if (rejectionReason && rejectionReason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        {
          error: `rejection_reason must be ${MAX_REASON_LENGTH} chars or less`,
        },
        { status: 400 }
      );
    }

    // Confirm the merge involves [id] before authorizing rejection
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

    const result = await rejectMergeRequest({
      mergeId,
      approverId: auth.adminId,
      rejectionReason,
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        not_authorized: 403,
        merge_not_found: 404,
        wrong_status: 409,
      };
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          message: result.message,
        },
        {
          status: statusMap[result.reason] ?? 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    return NextResponse.json(
      { ok: true, merge_id: result.mergeId },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[admin/merge-requests/reject POST] unexpected:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
