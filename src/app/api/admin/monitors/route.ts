import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkPipelineHealth,
  checkCostAlerts,
  checkQualityDrift,
  checkEditTrackerSummary,
  checkStaleData,
  checkUsageAnalytics,
} from "@/lib/admin/monitors";

const MONITORS = {
  pipeline: checkPipelineHealth,
  cost: checkCostAlerts,
  quality: checkQualityDrift,
  edits: checkEditTrackerSummary,
  stale: checkStaleData,
  usage: checkUsageAnalytics,
} as const;

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const monitor = req.nextUrl.searchParams.get("monitor");

    if (monitor && monitor in MONITORS) {
      const result = await MONITORS[monitor as keyof typeof MONITORS](supabase);
      return NextResponse.json({ [monitor]: result });
    }

    // Run all monitors
    const results = await Promise.allSettled(
      Object.entries(MONITORS).map(async ([key, fn]) => [key, await fn(supabase)])
    );

    const data: Record<string, unknown> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        const [key, value] = r.value as [string, unknown];
        data[key] = value;
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin/monitors] Error:", error);
    return NextResponse.json({ error: "Monitor check failed" }, { status: 500 });
  }
}
