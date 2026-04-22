/**
 * POST /api/student/fabrication/jobs/[jobId]/acknowledge-warning
 *
 * Preflight Phase 5-1. Persists a single soft-gate acknowledgement.
 * Writes to fabrication_jobs.acknowledged_warnings JSONB, merge-patched
 * by revision_N → rule_id key.
 *
 * Called per-click from the ScanResultsViewer's should-fix radio groups.
 *
 * Auth: student cookie-token session; verifies ownership.
 * Cache: private, no-cache.
 *
 * Response 200: { acknowledgedWarnings }  (full merged object, for optimistic UI sync)
 * Errors:
 *   400 invalid body (bad choice / missing ruleId / bad revisionNumber)
 *   401 unauthenticated
 *   404 job not found OR not owned
 *   500 DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACK_CHOICES,
  acknowledgeWarning,
  isOrchestrationError,
  type AckChoice,
} from "@/lib/fabrication/orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireStudentAuth(request);
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
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be JSON object" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  const b = body as Record<string, unknown>;

  // Narrow choice at the route layer too (belt-and-braces with the lib's
  // validation). Gives a cleaner error message tied to the request body.
  if (typeof b.choice !== "string" || !ACK_CHOICES.includes(b.choice as AckChoice)) {
    return NextResponse.json(
      { error: `choice must be one of: ${ACK_CHOICES.join(", ")}` },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await acknowledgeWarning(db, {
    studentId: auth.studentId,
    jobId,
    revisionNumber:
      typeof b.revisionNumber === "number" ? b.revisionNumber : NaN,
    ruleId: typeof b.ruleId === "string" ? b.ruleId : "",
    choice: b.choice as AckChoice,
  });

  if (isOrchestrationError(result)) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    { acknowledgedWarnings: result.acknowledgedWarnings },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
