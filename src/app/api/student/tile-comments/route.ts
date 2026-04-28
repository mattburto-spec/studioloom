/**
 * GET /api/student/tile-comments?unitId=X&pageId=Y
 *
 * Returns the student's anchored teacher comments for tiles on this page —
 * one per (unit, page, tile_id). Driven by the G2.3 schema column
 * `student_tile_grades.student_facing_comment`.
 *
 * Visibility: the row exists + the column is non-null + non-empty IS the
 * "released to student" contract for v1. No separate is_visible flag —
 * teacher writes it, student sees it. (Future iteration: gate behind a
 * comment_released_at if Matt wants drafts.)
 *
 * Auth: student session token (custom — students don't use Supabase Auth).
 * The admin client below is gated by requireStudentAuth's session check
 * matching auth.studentId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";

interface TileCommentRow {
  tile_id: string;
  page_id: string;
  student_facing_comment: string;
  score: number | null;
  released_at: string | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const url = request.nextUrl.searchParams;
  const unitId = url.get("unitId");
  const pageId = url.get("pageId");
  if (!unitId || !pageId) {
    return NextResponse.json({ error: "unitId and pageId required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("student_tile_grades")
    .select("tile_id, page_id, student_facing_comment, score, released_at")
    .eq("student_id", auth.studentId)
    .eq("unit_id", unitId)
    .eq("page_id", pageId)
    .not("student_facing_comment", "is", null);

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch comments: ${error.message}` },
      { status: 500 },
    );
  }

  // Drop empty-string comments (DB allows them; UI doesn't want to render them).
  const comments = ((data ?? []) as TileCommentRow[]).filter(
    (r) => r.student_facing_comment && r.student_facing_comment.trim().length > 0,
  );

  return NextResponse.json({ comments });
}
