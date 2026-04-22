/**
 * GET /api/teacher/fabrication/students/[studentId]/history
 *
 * Phase 6-4 per-student fabrication history. Returns every submission
 * the teacher owns for this student, plus summary metrics (pass rate,
 * avg revisions, top failure rule).
 *
 * Scoping: `fabrication_jobs.teacher_id = requireTeacherAuth()` AND
 * `student_id = studentId`. Same "404 for not yours" pattern as 6-2
 * (not 403 — doesn't telegraph existence).
 *
 * Response 200: HistorySuccess (see teacher-orchestration.ts)
 * Errors: 401, 500
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeacherStudentHistory } from "@/lib/fabrication/teacher-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { studentId } = await context.params;
  if (!studentId || typeof studentId !== "string") {
    return NextResponse.json(
      { error: "studentId required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await getTeacherStudentHistory(db, {
    teacherId: auth.teacherId,
    studentId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
