import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Last 24h generation runs
    const { data: recentRuns, error: runsError } = await supabase
      .from("generation_runs")
      .select(
        "id, status, total_cost, total_time_ms, current_stage, quality_report, created_at, error_message, error_stage"
      )
      .gte("created_at", yesterday.toISOString())
      .order("created_at", { ascending: false });

    if (runsError) throw runsError;

    const runs = recentRuns || [];
    const completed = runs.filter((r) => r.status === "completed");
    const failed = runs.filter((r) => r.status === "failed");
    const running = runs.filter((r) => r.status === "running");
    const successRate = runs.length > 0 ? completed.length / runs.length : 1;

    // Compute avg/p95 time
    const times = completed
      .map((r) => r.total_time_ms)
      .filter((t): t is number => t !== null && t !== undefined)
      .sort((a, b) => a - b);
    const avgTimeMs = times.length > 0 ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0;
    const p95TimeMs = times.length > 0 ? times[Math.floor(times.length * 0.95)] || times[times.length - 1] : 0;

    // Compute avg cost (total_cost is JSONB)
    const costs = completed
      .map((r) => {
        try {
          const c = typeof r.total_cost === "string" ? JSON.parse(r.total_cost) : r.total_cost;
          if (!c) return 0;
          return c.total ?? c.totalUsd ?? c.totalUSD ?? 0;
        } catch {
          return 0;
        }
      })
      .filter((c) => c > 0);
    const avgCost = costs.length > 0 ? costs.reduce((s, c) => s + c, 0) / costs.length : 0;

    // 2. Stage failure breakdown
    const stageFailures: Record<number, number> = {};
    for (const r of failed) {
      const stage = r.error_stage ?? r.current_stage ?? 0;
      stageFailures[stage] = (stageFailures[stage] || 0) + 1;
    }

    // 3. Cost per period (last 24h, 7d, 30d)
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { data: weekRuns } = await supabase
      .from("generation_runs")
      .select("total_cost")
      .gte("created_at", week.toISOString())
      .eq("status", "completed");

    const { data: monthRuns } = await supabase
      .from("generation_runs")
      .select("total_cost")
      .gte("created_at", month.toISOString())
      .eq("status", "completed");

    const costPeriods = {
      dayUsd: avgCost * completed.length,
      weekUsd: (weekRuns || [])
        .map((r) => {
          try {
            const c = typeof r.total_cost === "string" ? JSON.parse(r.total_cost) : r.total_cost;
            return c?.total ?? c?.totalUsd ?? c?.totalUSD ?? 0;
          } catch {
            return 0;
          }
        })
        .reduce((s, c) => s + c, 0),
      monthUsd: (monthRuns || [])
        .map((r) => {
          try {
            const c = typeof r.total_cost === "string" ? JSON.parse(r.total_cost) : r.total_cost;
            return c?.total ?? c?.totalUsd ?? c?.totalUSD ?? 0;
          } catch {
            return 0;
          }
        })
        .reduce((s, c) => s + c, 0),
    };

    // 4. Recent system_alerts for pipeline health + cost alerts
    const { data: alerts } = await supabase
      .from("system_alerts")
      .select("*")
      .in("alert_type", ["pipeline_health", "cost_alert", "quality_drift", "smoke_test"])
      .order("created_at", { ascending: false })
      .limit(20);

    // 5. Quality drift (from system_alerts)
    const { data: qualityAlerts } = await supabase
      .from("system_alerts")
      .select("payload, created_at")
      .eq("alert_type", "quality_drift")
      .order("created_at", { ascending: false })
      .limit(30);

    // 6. Last 20 failed runs for error log
    const failedRuns = failed.slice(0, 20).map((r) => ({
      id: r.id,
      stage: r.error_stage ?? r.current_stage,
      error: r.error_message,
      created_at: r.created_at,
    }));

    // 7. Latest cost alert
    const { data: costAlerts } = await supabase
      .from("system_alerts")
      .select("*")
      .eq("alert_type", "cost_alert")
      .order("created_at", { ascending: false })
      .limit(1);

    const latestCostAlert = costAlerts && costAlerts.length > 0 ? costAlerts[0] : null;

    return NextResponse.json({
      summary: {
        totalRuns: runs.length,
        completed: completed.length,
        failed: failed.length,
        running: running.length,
        successRate,
        avgTimeMs,
        p95TimeMs,
        avgCost,
      },
      costPeriods,
      stageFailures,
      alerts: alerts || [],
      qualityAlerts: qualityAlerts || [],
      failedRuns,
      latestCostAlert,
    });
  } catch (err) {
    console.error("[admin/pipeline/health GET]", err);
    return NextResponse.json({ error: "Failed to fetch pipeline health" }, { status: 500 });
  }
}
