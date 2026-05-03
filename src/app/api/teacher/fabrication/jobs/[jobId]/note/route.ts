// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/fabrication/jobs/[jobId]/note
 *
 * Preflight Phase 6-1. Add/update a teacher note WITHOUT changing
 * status. For mid-review comments before committing to an action.
 * Single-field v1 — overwrites any existing note (PH6-FU-NOTE-
 * HISTORY P3 tracks the threaded/audit-log follow-up).
 *
 * Body: { note: string } — required, non-empty.
 * Auth: teacher. Cache: private, no-cache.
 *
 * Response 200: { jobId, newStatus (unchanged), teacherReviewedAt }
 * Errors: 400 (missing note), 401, 404, 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { addTeacherNote } from "@/lib/fabrication/teacher-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json(
      { error: "jobId required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  const b = (body as Record<string, unknown>) || {};
  const note = typeof b.note === "string" ? b.note : "";

  const db = createAdminClient();
  const result = await addTeacherNote(db, {
    teacherId: auth.teacherId,
    jobId,
    note,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
