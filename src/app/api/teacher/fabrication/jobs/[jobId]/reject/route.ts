/**
 * POST /api/teacher/fabrication/jobs/[jobId]/reject
 *
 * Preflight Phase 6-1. Transitions `fabrication_jobs.status` from
 * `pending_approval` → `rejected`. Hard stop — student cannot
 * re-upload on this job. Used for safety-flagged content (weapon
 * STL, plagiarism, etc).
 *
 * Body: { note?: string } — optional but recommended.
 * Auth: teacher. Cache: private, no-cache.
 *
 * Response 200: { jobId, newStatus: "rejected", teacherReviewedAt }
 * Errors: 401, 404, 409, 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectJob } from "@/lib/fabrication/teacher-orchestration";

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

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  const b = (body as Record<string, unknown>) || {};
  const note = typeof b.note === "string" ? b.note : undefined;

  const db = createAdminClient();
  const result = await rejectJob(db, { teacherId: auth.teacherId, jobId, note });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
