/**
 * GET /api/cron/scheduled-hard-delete
 *
 * Vercel Cron Jobs entry point for the daily scheduled-hard-delete sweep.
 *
 * Auth: validates `Authorization: Bearer ${CRON_SECRET}` (Vercel
 * automatically attaches this header to cron-invoked GETs when the
 * project has CRON_SECRET set in env). Without the env var or with
 * a mismatched header, returns 401.
 *
 * Scheduled in vercel.json: daily at 03:00 UTC (= 11:00 Nanjing —
 * mid-morning, off-peak DB load).
 *
 * Behaviour: delegates to `run()` in src/lib/jobs/scheduled-hard-delete-cron.ts
 * (Phase 5.5 / Q5 resolution). Reads scheduled_deletions WHERE status='pending'
 * AND scheduled_for < now(); deletes the target rows; updates status='completed'.
 * Both producers feed this queue: DSR student-delete + retention-enforcement.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { run } from "@/lib/jobs/scheduled-hard-delete-cron";

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
      job: "scheduled-hard-delete",
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/scheduled-hard-delete] failed:", message);
    return NextResponse.json(
      { ok: false, job: "scheduled-hard-delete", error: message },
      { status: 500 },
    );
  }
}
