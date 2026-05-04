/**
 * GET /api/cron/retention-enforcement
 *
 * Vercel Cron Jobs entry point for the monthly retention-enforcement
 * sweep.
 *
 * Auth: validates `Authorization: Bearer ${CRON_SECRET}` (Vercel
 * automatically attaches this header to cron-invoked GETs when the
 * project has CRON_SECRET set in env). Without the env var or with
 * a mismatched header, returns 401.
 *
 * Scheduled in vercel.json: monthly on the 1st at 04:00 UTC (= 12:00
 * Nanjing — midday, deliberate to flush before end-of-day cron stack).
 *
 * Behaviour: delegates to `run()` in src/lib/jobs/retention-enforcement.ts
 * (Phase 5.5). Walks the RETENTION_MANIFEST (currently empty in v1 — see
 * the source file for v1-pilot rationale). When entries are added, this
 * cron soft-deletes rows past their horizon and queues hard-deletes via
 * the scheduled_deletions table (consumed by the daily
 * scheduled-hard-delete cron above).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { run } from "@/lib/jobs/retention-enforcement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const result = await run(supabase);
    return NextResponse.json({
      ok: true,
      job: "retention-enforcement",
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/retention-enforcement] failed:", message);
    return NextResponse.json(
      { ok: false, job: "retention-enforcement", error: message },
      { status: 500 },
    );
  }
}
