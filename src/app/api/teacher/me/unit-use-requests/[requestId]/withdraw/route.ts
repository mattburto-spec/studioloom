// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/me/unit-use-requests/[requestId]/withdraw
 * Phase 4.6 — requester withdraws their own pending request.
 */

import { NextRequest, NextResponse } from "next/server";
import { withdrawRequest } from "@/lib/access-v2/school/unit-use-requests";
import { requireTeacher } from "@/lib/auth/require-teacher";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const { requestId } = await ctx.params;
    if (!UUID_RE.test(requestId)) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
    }

    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const { teacherId } = auth;

    const result = await withdrawRequest({
      requestId,
      requesterUserId: teacherId,
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        request_not_found: 404,
        not_authorized: 403,
        wrong_status: 409,
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
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[unit-use-requests/withdraw POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
