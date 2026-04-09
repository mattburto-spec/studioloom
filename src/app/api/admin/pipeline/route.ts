import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const status = req.nextUrl.searchParams.get("status");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

    let query = supabase
      .from("generation_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: runs, error } = await query;
    if (error) throw error;

    // Compute per-stage stats from stage_results JSONB
    const stageStats: Record<string, { total: number; avgMs: number; errors: number }> = {};
    for (const run of runs || []) {
      const stages = run.stage_results;
      if (!stages || typeof stages !== "object") continue;
      for (const [stageName, result] of Object.entries(stages as Record<string, any>)) {
        if (!stageStats[stageName]) stageStats[stageName] = { total: 0, avgMs: 0, errors: 0 };
        stageStats[stageName].total++;
        stageStats[stageName].avgMs += result.timeMs || 0;
        if (result.error) stageStats[stageName].errors++;
      }
    }
    // Compute averages
    for (const stats of Object.values(stageStats)) {
      if (stats.total > 0) stats.avgMs = Math.round(stats.avgMs / stats.total);
    }

    return NextResponse.json({ runs: runs || [], stageStats });
  } catch (error) {
    console.error("[admin/pipeline] Error:", error);
    return NextResponse.json({ runs: [], stageStats: {} });
  }
}
