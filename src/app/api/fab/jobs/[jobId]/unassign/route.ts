/**
 * POST /api/fab/jobs/[jobId]/unassign
 *
 * Phase 8.1d-27. Fabricator removes a job from a specific
 * machine's queue, returning it to the "Any [category]" incoming
 * row so a different machine can pick it up.
 *
 * Allowed only when status='approved' (can't undo a running pickup
 * — that's Mark Failed). Idempotent: unassigning an already-
 * unassigned job is a no-op success.
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-store.
 *
 * Response 200: { jobId }
 * Errors: 400 invalid jobId, 401 no session, 404 job not owned by
 *         inviting teacher, 409 wrong status, 500 DB failure.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { unassignMachine } from "@/lib/fabrication/fab-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireFabricatorAuth(request);
  if ("error" in auth) return auth.error;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string" || !UUID_RE.test(jobId)) {
    return NextResponse.json(
      { error: "jobId must be a UUID" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await unassignMachine(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, {
    status: 200,
    headers: NO_CACHE_HEADERS,
  });
}
