/**
 * GET /api/cron/cost-alert
 *
 * Vercel Cron Jobs entry point for the daily cost-alert sweep.
 *
 * Auth: validates `Authorization: Bearer ${CRON_SECRET}` (Vercel
 * automatically attaches this header to cron-invoked GETs when the
 * project has CRON_SECRET set in env). Without the env var or with
 * a mismatched header, returns 401 — prevents unauthenticated public
 * invocation of the cron logic.
 *
 * Scheduled in vercel.json: daily at 06:00 UTC (= 14:00 Nanjing local
 * — after morning teaching, low-load window).
 *
 * Behaviour: delegates to the existing `run()` in
 * src/lib/jobs/cost-alert.ts (Phase 5.7); same logic invoked locally
 * via scripts/ops/run-cost-alert.ts. Returns the alert summary as JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { run } from "@/lib/jobs/cost-alert";

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
      job: "cost-alert",
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/cost-alert] failed:", message);
    return NextResponse.json(
      { ok: false, job: "cost-alert", error: message },
      { status: 500 },
    );
  }
}
