/**
 * GET /api/admin/cost-usage
 *
 * Returns cost rollup data for the admin Cost & Usage dashboard.
 * Query params: ?period=7d|30d|all (default: 30d)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const period = request.nextUrl.searchParams.get("period") || "30d";

  const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "all": 3650 };
  const days = daysMap[period] ?? 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  try {
    // Per-teacher cost rollups (4 categories)
    const { data: costRollups, error: costErr } = await supabase
      .from("cost_rollups")
      .select("*")
      .gte("period_start", since.split("T")[0])
      .order("period_start", { ascending: false });

    if (costErr) throw costErr;

    // Recent generation runs for trend data
    const { data: recentRuns, error: runsErr } = await supabase
      .from("generation_runs")
      .select("id, teacher_id, total_cost_usd, created_at, status")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (runsErr) throw runsErr;

    // Aggregate per-teacher
    const teacherMap = new Map<string, {
      teacherId: string;
      ingestion: number;
      generation: number;
      student_api: number;
      teacher_api: number;
      total: number;
      runCount: number;
    }>();

    for (const row of costRollups || []) {
      const tid = row.teacher_id || "system";
      if (!teacherMap.has(tid)) {
        teacherMap.set(tid, {
          teacherId: tid,
          ingestion: 0,
          generation: 0,
          student_api: 0,
          teacher_api: 0,
          total: 0,
          runCount: 0,
        });
      }
      const entry = teacherMap.get(tid)!;
      const cat = row.category as keyof typeof entry;
      if (cat in entry && typeof entry[cat] === "number") {
        (entry[cat] as number) += Number(row.cost_usd) || 0;
      }
      entry.total += Number(row.cost_usd) || 0;
    }

    // Count runs per teacher
    for (const run of recentRuns || []) {
      const tid = run.teacher_id || "system";
      const entry = teacherMap.get(tid);
      if (entry) entry.runCount++;
    }

    // Daily cost trend
    const dailyCosts: Record<string, number> = {};
    for (const run of recentRuns || []) {
      const day = run.created_at?.split("T")[0] || "unknown";
      dailyCosts[day] = (dailyCosts[day] || 0) + (Number(run.total_cost_usd) || 0);
    }

    // Summary stats
    const totalCost = Array.from(teacherMap.values()).reduce((s, t) => s + t.total, 0);
    const totalRuns = recentRuns?.length || 0;
    const avgCostPerRun = totalRuns > 0 ? totalCost / totalRuns : 0;

    // Get budget thresholds from admin_settings
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["pipeline.cost_ceiling_per_day_usd", "pipeline.cost_ceiling_per_run_usd"]);

    const thresholds: Record<string, number> = {};
    for (const s of settings || []) {
      thresholds[s.key] = Number(s.value) || 0;
    }

    return NextResponse.json({
      period,
      summary: {
        totalCost: Math.round(totalCost * 100) / 100,
        totalRuns,
        avgCostPerRun: Math.round(avgCostPerRun * 1000) / 1000,
      },
      teachers: Array.from(teacherMap.values()).sort((a, b) => b.total - a.total),
      dailyCosts: Object.entries(dailyCosts)
        .map(([date, cost]) => ({ date, cost: Math.round(cost * 1000) / 1000 }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      thresholds,
    });
  } catch (e) {
    console.error("[admin/cost-usage] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load cost data" },
      { status: 500 }
    );
  }
}
