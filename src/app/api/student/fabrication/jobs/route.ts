/**
 * GET /api/student/fabrication/jobs
 *
 * Phase 6-6i student-side overview. Returns all fabrication jobs
 * owned by the authenticated student (scoped to `student_id`), newest
 * first, with per-revision signed thumbnail URLs + rule-count
 * summaries. Used by the `/fabrication` overview page.
 *
 * Auth: student cookie-token session.
 * Cache: private, no-store.
 *
 * Response 200: { jobs: StudentJobRow[] }
 * Errors: 401, 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listStudentJobs,
  isOrchestrationError,
} from "@/lib/fabrication/orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 100;
  if (!Number.isFinite(limit) || limit < 1) {
    return NextResponse.json(
      { error: "limit must be a positive integer" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await listStudentJobs(db, {
    studentId: auth.studentId,
    limit,
  });

  if (isOrchestrationError(result)) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
