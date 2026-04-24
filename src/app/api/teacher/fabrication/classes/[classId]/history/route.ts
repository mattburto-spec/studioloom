/**
 * GET /api/teacher/fabrication/classes/[classId]/history
 *
 * Phase 6-4 per-class fabrication history. Same shape as the student
 * history endpoint but adds a `perStudent` drill-down list for the
 * teacher's per-class view.
 *
 * Scoping: `fabrication_jobs.teacher_id = requireTeacherAuth()` AND
 * `class_id = classId`. Teacher ownership of the class is implied by
 * the teacher_id filter — a teacher who didn't create any jobs in a
 * class simply sees an empty history (same as "no submissions yet").
 *
 * Response 200: HistorySuccess
 * Errors: 401, 500
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeacherClassHistory } from "@/lib/fabrication/teacher-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { classId } = await context.params;
  if (!classId || typeof classId !== "string") {
    return NextResponse.json(
      { error: "classId required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await getTeacherClassHistory(db, {
    teacherId: auth.teacherId,
    classId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
