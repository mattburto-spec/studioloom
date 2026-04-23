/**
 * GET /api/fab/queue
 *
 * Preflight Phase 7-2. Fabricator's per-machine queue. Returns jobs
 * scoped to the fabricator's `fabricator_machines` assignments,
 * filtered by the tab param.
 *
 * Query params:
 *   tab=ready        — approved jobs waiting to be picked up (default)
 *   tab=in_progress  — this fabricator's own picked-up jobs
 *
 * Auth: fabricator cookie-token session (not Supabase Auth).
 * Cache: private, no-store (Lesson #11 — mutable state behind it).
 *
 * Response 200: { jobs: FabJobRow[] }
 * Errors: 401 (no session), 400 (bad tab), 500 (DB failure).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listFabricatorQueue,
  FAB_QUEUE_TABS,
  type FabQueueTab,
} from "@/lib/fabrication/fab-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireFabricatorAuth(request);
  if ("error" in auth) return auth.error;

  const tabParam = request.nextUrl.searchParams.get("tab") ?? "ready";
  if (!(FAB_QUEUE_TABS as readonly string[]).includes(tabParam)) {
    return NextResponse.json(
      {
        error: `Unknown tab '${tabParam}'. Valid: ${FAB_QUEUE_TABS.join(", ")}`,
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await listFabricatorQueue(db, {
    fabricatorId: auth.fabricator.id,
    tab: tabParam as FabQueueTab,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
