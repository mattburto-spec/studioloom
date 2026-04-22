/**
 * POST /api/teacher/fabrication/jobs/[jobId]/return-for-revision
 *
 * Preflight Phase 6-1. Transitions `fabrication_jobs.status` from
 * `pending_approval` → `needs_revision`. Requires a note — the student
 * sees it on their status page and re-uploads a fixed version as
 * Rev N+1.
 *
 * Body: { note: string } — REQUIRED (empty note = 400).
 * Auth: teacher. Cache: private, no-cache.
 *
 * Response 200: { jobId, newStatus: "needs_revision", teacherReviewedAt }
 * Errors: 400 (missing note), 401, 404, 409, 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { returnForRevision } from "@/lib/fabrication/teacher-orchestration";

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
  const result = await returnForRevision(db, {
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
