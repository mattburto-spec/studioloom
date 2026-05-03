// audit-skip: routine fab-tech operational endpoint, audit lives in fabrication pipeline state machine
/**
 * POST /api/fab/jobs/[jobId]/complete
 *
 * Phase 7-2. Fabricator marks a picked-up job as completed
 * (printed / cut). Derives `completion_status` from the machine
 * category ('printed' for 3d_printer, 'cut' for laser_cutter).
 *
 * Body (optional):
 *   { completion_note?: string }  — free-text "went fine" note
 *
 * Ownership: the fabricator must be the one who picked this job
 * up. Current machine assignment is NOT required (§11 Q8 — if
 * they already picked it up, let them log the outcome even after
 * being unassigned).
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-store.
 *
 * Response 200: { jobId, completionStatus, completedAt }
 * Errors: 401, 404 (not owner), 409 (not in picked_up status),
 * 500 (DB failure).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { markComplete } from "@/lib/fabrication/fab-orchestration";

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
    // Empty body is acceptable — note is optional.
  }
  const completionNote =
    typeof body.completion_note === "string" ? body.completion_note : undefined;

  const db = createAdminClient();
  const result = await markComplete(db, {
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
