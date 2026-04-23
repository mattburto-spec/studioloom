/**
 * GET /api/fab/jobs/[jobId]
 *
 * Phase 7-2. Single-job detail for the fabricator detail page.
 * Visibility: fabricator must be CURRENTLY assigned to the job's
 * machine, OR they must be the one who picked it up (§11 Q8 allows
 * access-after-unassignment for own picked-up jobs).
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-store.
 *
 * Response 200: FabJobDetail (see fab-orchestration.ts)
 * Errors: 401, 404 (not found OR not accessible), 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFabJobDetail } from "@/lib/fabrication/fab-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(
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

  const db = createAdminClient();
  const result = await getFabJobDetail(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
