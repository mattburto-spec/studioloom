// audit-skip: school-scoped operation; audit covered by school_settings_history (mig 087)
/**
 * POST /api/school/[id]/library/[unitId]/request-use
 *
 * Phase 4.6 — teacher requests permission to use a colleague's unit.
 * Helper enforces same-school + non-self-author + no-duplicate-pending.
 *
 * Auth: authenticated teacher attached to [id].
 *
 * Request body:
 *   { intent_message?: string }
 *
 * Response (201): { request_id: string }
 *
 * Errors:
 *   400 — invalid id
 *   401 — unauthenticated
 *   403 — not a member of [id]
 *   404 — unit not found OR not published
 *   409 — duplicate pending OR self-request
 *   422 — cross-school (shouldn't happen via UI but defence-in-depth)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestUse } from "@/lib/access-v2/school/unit-use-requests";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string; unitId: string }>;
};

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const { id: schoolId, unitId } = await ctx.params;
    if (!UUID_RE.test(schoolId) || !UUID_RE.test(unitId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { intent_message?: unknown } = {};
    try {
      const text = await request.text();
      if (text.trim().length > 0) body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const intentMessage =
      typeof body.intent_message === "string"
        ? body.intent_message.slice(0, 2000)
        : undefined;

    // Membership check
    const admin = createAdminClient();
    const { data: viewer } = await admin
      .from("teachers")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!viewer?.school_id || viewer.school_id !== schoolId) {
      return NextResponse.json(
        { error: "Forbidden — must be a member of this school" },
        { status: 403 }
      );
    }

    const result = await requestUse({
      unitId,
      requesterUserId: user.id,
      intentMessage,
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        unit_not_found: 404,
        unit_not_published: 404,
        self_request: 409,
        cross_school: 422,
        duplicate_pending: 409,
        requester_no_school: 403,
        db_error: 500,
      };
      return NextResponse.json(
        { ok: false, reason: result.reason, message: result.message },
        {
          status: statusMap[result.reason] ?? 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    return NextResponse.json(
      { ok: true, request_id: result.requestId },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[library/request-use POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
