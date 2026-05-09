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
 * matching session.studentId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";

interface TileCommentRow {
  tile_id: string;
  page_id: string;
  student_facing_comment: string;
  score: number | null;
  released_at: string | null;
}

export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const url = request.nextUrl.searchParams;
  const unitId = url.get("unitId");
  const pageId = url.get("pageId");
  if (!unitId || !pageId) {
    return NextResponse.json({ error: "unitId and pageId required" }, { status: 400 });
  }

  const db = createAdminClient();

  // TFL.1.2 — bump read receipt BEFORE the SELECT, so the response always
  // reflects the just-written timestamp. Filter to rows that actually have
  // a comment (empty/null student_facing_comment = nothing the student is
  // "reading", no false receipt). No write to student_tile_grade_events;
  // receipts are not audit-worthy at the per-load grain (would explode
  // the events table). Idempotent — repeat hits just refresh the timestamp.
  //
  // TFL.1 hotfix (migration 20260509222601): we route the bump through a
  // SECURITY DEFINER SQL function so `student_seen_comment_at` and the
  // BEFORE-UPDATE trigger's `updated_at` both derive from the same Postgres
  // `now()` (transaction-start time, identical across SET clause + trigger).
  // The original inline UPDATE used `new Date().toISOString()` from Node,
  // which landed ~100–200ms BEFORE the trigger's `now()`, so even on a fresh
  // receipt the chip's `seen >= updated_at` check returned false and the
  // tooltip read "Seen the older version". The RPC fixes the race.
  await db.rpc("bump_student_seen_comment_at", {
    p_student_id: session.studentId,
    p_unit_id: unitId,
    p_page_id: pageId,
  });

  const { data, error } = await db
    .from("student_tile_grades")
    .select("tile_id, page_id, student_facing_comment, score, released_at")
    .eq("student_id", session.studentId)
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
