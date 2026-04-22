/**
 * GET /api/teacher/fabrication/queue
 *
 * Preflight Phase 6-1. Returns the teacher's submissions queue for the
 * /teacher/preflight page. Scoped to jobs where
 * `fabrication_jobs.teacher_id = requireTeacherAuth().teacherId`. No
 * cross-teacher visibility.
 *
 * Query params:
 *   status=pending_approval            — single status filter
 *   status=approved,picked_up          — comma-separated multi-status
 *   (absent)                           — all statuses
 *   limit=50                           — page size (default 50, max 200)
 *   offset=0                           — pagination
 *
 * Response 200:
 *   { total: number, rows: QueueRow[] }
 *
 * Errors:
 *   401 unauthenticated
 *   500 DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTeacherQueue,
  QUEUE_STATUSES,
} from "@/lib/fabrication/teacher-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const url = request.nextUrl;
  const statusParam = url.searchParams.get("status");
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  // Parse status filter. Comma-separated values become an array for
  // the `in.()` postgres filter.
  let statuses: string[] | undefined;
  if (statusParam) {
    const parts = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Reject unknown values to fail fast instead of silently returning empty.
    const invalid = parts.filter(
      (s) => !(QUEUE_STATUSES as readonly string[]).includes(s)
    );
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Unknown status value(s): ${invalid.join(", ")}. Valid: ${QUEUE_STATUSES.join(", ")}`,
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    statuses = parts;
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  if (!Number.isFinite(limit) || !Number.isFinite(offset)) {
    return NextResponse.json(
      { error: "limit and offset must be integers" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await getTeacherQueue(db, {
    teacherId: auth.teacherId,
    statuses,
    limit,
    offset,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
