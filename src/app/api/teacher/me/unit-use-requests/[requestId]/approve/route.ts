// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/me/unit-use-requests/[requestId]/approve
 *
 * Phase 4.6 — author approves a pending request. Helper creates a fork
 * for the requester with attribution preserved (units.forked_from +
 * units.forked_from_author_id). Audit row logged.
 *
 * Auth: authenticated teacher; helper enforces author_user_id match.
 *
 * Body: { response?: string }
 *
 * Status mapping:
 *   200 — approved + fork created (returns forked_unit_id)
 *   400 — invalid id
 *   401 — unauthenticated
 *   403 — not the author of this request
 *   404 — request not found
 *   409 — wrong status (already decided)
 *   500 — fork_failed (request stays pending; retry possible) OR db_error
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { approveRequest } from "@/lib/access-v2/school/unit-use-requests";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const { requestId } = await ctx.params;
    if (!UUID_RE.test(requestId)) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
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

    let body: { response?: unknown } = {};
    try {
      const text = await request.text();
      if (text.trim().length > 0) body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await approveRequest({
      requestId,
      authorUserId: user.id,
      response:
        typeof body.response === "string" ? body.response.slice(0, 2000) : undefined,
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        request_not_found: 404,
        not_authorized: 403,
        wrong_status: 409,
        fork_failed: 500,
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
      {
        ok: true,
        request_id: result.requestId,
        forked_unit_id: result.forkedUnitId,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[unit-use-requests/approve POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
