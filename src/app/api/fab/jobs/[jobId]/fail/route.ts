// audit-skip: routine fab-tech operational endpoint, audit lives in fabrication pipeline state machine
/**
 * POST /api/fab/jobs/[jobId]/fail
 *
 * Phase 7-2. Fabricator marks a picked-up job as failed to run.
 * Transitions status=picked_up → completed with
 * completion_status='failed'. Note is REQUIRED — student + teacher
 * both need to know WHY the run failed ("warped off the bed",
 * "laser didn't cut through", etc.).
 *
 * Body (required):
 *   { completion_note: string }  — non-empty, will be trimmed
 *
 * Ownership: same as /complete — must be the fabricator who
 * picked this job up. Current machine assignment not required
 * (§11 Q8).
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-store.
 *
 * Response 200: { jobId, completionStatus: 'failed', completedAt }
 * Errors: 401, 400 (missing/empty note), 404 (not owner), 409 (not
 * in picked_up), 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { markFailed } from "@/lib/fabrication/fab-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireFabricatorAuth(request);
  if ("error" in auth) return auth.error;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json(
      { error: "jobId required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  let body: { completion_note?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  const completionNote =
    typeof body.completion_note === "string" ? body.completion_note : "";

  // Orchestration also validates — but fail fast here with a 400
  // so the client sees a shape-level error before we hit the DB.
  if (!completionNote.trim()) {
    return NextResponse.json(
      { error: "A note is required when marking a run as failed." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await markFailed(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
    completionNote,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
