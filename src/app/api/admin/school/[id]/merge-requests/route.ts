/**
 * GET /api/admin/school/[id]/merge-requests
 *
 * Phase 4.5 — platform-admin list of merge requests touching school [id]
 * (either as from-side or into-side). Used by /admin/school/[id] super-admin
 * view (Phase 4.7).
 *
 * Auth: platform admin only (is_platform_admin=true on user_profiles).
 *
 * Query params:
 *   ?status=pending|approved|rejected|completed (optional; multi-value via
 *           comma — e.g. ?status=pending,approved)
 *
 * Response:
 *   { ok: true, merge_requests: SchoolMergeRequest[] }
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.5.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ["pending", "approved", "rejected", "completed"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePlatformAdmin(request);
    if ("error" in auth) return auth.error;

    const { id: schoolId } = await ctx.params;
    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const statusFilter: ValidStatus[] = [];
    if (statusParam) {
      const requested = statusParam.split(",").map((s) => s.trim());
      for (const s of requested) {
        if (VALID_STATUSES.includes(s as ValidStatus)) {
          statusFilter.push(s as ValidStatus);
        }
      }
      if (statusFilter.length === 0) {
        return NextResponse.json(
          {
            error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const admin = createAdminClient();
    let query = admin
      .from("school_merge_requests")
      .select(
        "id, from_school_id, into_school_id, requested_by_user_id, reason, status, approved_by_user_id, approved_at, completed_at, rejected_at, rejection_reason, created_at"
      )
      .or(`from_school_id.eq.${schoolId},into_school_id.eq.${schoolId}`)
      .order("created_at", { ascending: false });

    if (statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }

    const { data: rows, error: queryErr } = await query;
    if (queryErr) {
      console.error("[admin/merge-requests GET] db error:", queryErr);
      return NextResponse.json(
        { error: "Server error" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, merge_requests: rows ?? [] },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[admin/merge-requests GET] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
