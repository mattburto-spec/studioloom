/**
 * GET /api/student/tile-feedback?unitId=X&pageId=Y
 *
 * TFL.2 Pass B sub-phase B.2. Returns the multi-turn feedback threads
 * for the requesting student × unit × page, grouped by tile_id. Drops
 * into the `<TeacherFeedback turns={threads[tileId] ?? []} />`
 * component without massaging.
 *
 * Read-receipt: bumps `student_seen_comment_at` via the existing
 * TFL.1 RPC (`bump_student_seen_comment_at`) — same mechanism the
 * legacy `/api/student/tile-comments` route uses. Single source of
 * truth on the receipt timestamp; the chip dot ladder on the marking
 * page keeps working unchanged.
 *
 * Auth: requireStudentSession (custom student session token, not
 * Supabase Auth). The admin client is gated by the session check.
 */

// audit-skip: routine read endpoint, no audit value beyond TFL.1 receipt

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadTileFeedbackThreads } from "@/lib/grading/tile-feedback-loader";
import type { Turn } from "@/components/lesson/TeacherFeedback/types";

export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const url = request.nextUrl.searchParams;
  const unitId = url.get("unitId");
  const pageId = url.get("pageId");
  if (!unitId || !pageId) {
    return NextResponse.json(
      { error: "unitId and pageId required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // TFL.1 read-receipt bump BEFORE the SELECT, mirroring the legacy
  // /api/student/tile-comments route. Routes the bump through the
  // SECURITY DEFINER RPC so `student_seen_comment_at` and the
  // BEFORE-UPDATE trigger's `updated_at` derive from the same
  // Postgres `now()` (Lesson #66; fix lives in migration
  // 20260509222601_add_bump_student_seen_comment_at_rpc.sql).
  await db.rpc("bump_student_seen_comment_at", {
    p_student_id: session.studentId,
    p_unit_id: unitId,
    p_page_id: pageId,
  });

  let threadsByTileId: Record<string, Turn[]>;
  try {
    threadsByTileId = await loadTileFeedbackThreads(
      db,
      session.studentId,
      unitId,
      pageId,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load tile feedback threads",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ threadsByTileId });
}
