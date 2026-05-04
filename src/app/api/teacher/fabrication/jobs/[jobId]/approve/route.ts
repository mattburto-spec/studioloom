// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/fabrication/jobs/[jobId]/approve
 *
 * Preflight Phase 6-1. Transitions `fabrication_jobs.status` from
 * `pending_approval` → `approved`. Writes `teacher_reviewed_by` +
 * `teacher_reviewed_at`. Optional note.
 *
 * Body: { note?: string }
 * Auth: teacher Supabase Auth session.
 * Cache: private, no-cache.
 *
 * Response 200: { jobId, newStatus, teacherReviewedAt }
 * Errors: 401, 404 (not found OR not owned), 409 (not in
 * pending_approval state), 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveJob } from "@/lib/fabrication/teacher-orchestration";

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
    // Body is optional for approve — empty body = no note.
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
  const result = await approveJob(db, { teacherId: auth.teacherId, jobId, note });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
