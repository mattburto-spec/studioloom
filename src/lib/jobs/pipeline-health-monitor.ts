import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Job 1: Pipeline Health Monitor
 * Query generation_runs for last 24h. Compute success rate, timing stats, and avg cost.
 * Write to system_alerts with severity based on success rate.
 */
export async function run(
  supabase: SupabaseClient
): Promise<{ alertId: string; summary: Record<string, unknown> }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: runs, error } = await supabase
    .from("generation_runs")
    .select("id, status, total_time_ms, total_cost")
    .gte("created_at", oneDayAgo);

  if (error) {
    throw new Error(`Failed to fetch generation runs: ${error.message}`);
  }

  const runData = runs ?? [];
  const totalRuns = runData.length;
  const completed = runData.filter((r) => r.status === "completed").length;
  const failed = runData.filter((r) => r.status === "failed").length;
  const successRate = totalRuns > 0 ? completed / totalRuns : 1.0;

  // Compute timing stats
  const times = runData
    .filter((r) => r.total_time_ms)
    .map((r) => r.total_time_ms as number);
  const avgTimeMs = times.length > 0 ? Math.floor(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const p95TimeMs =
    times.length > 0
      ? Math.floor(times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)])
      : 0;

  // Extract cost from JSONB (handle gracefully)
  let totalCost = 0;
  for (const run of runData) {
    const cost = run.total_cost as unknown;
    if (cost && typeof cost === "object") {
      const costObj = cost as Record<string, unknown>;
      if (typeof costObj.total === "number") {
        totalCost += costObj.total;
      }
    }
  }
  const avgCost = totalRuns > 0 ? Number((totalCost / totalRuns).toFixed(4)) : 0;

  // Determine severity
  let severity: "info" | "warning" | "critical";
  if (successRate >= 0.95) {
    severity = "info";
  } else if (successRate >= 0.8) {
    severity = "warning";
  } else {
    severity = "critical";
  }

  // Write to system_alerts
  const { data: alertData, error: insertError } = await supabase
    .from("system_alerts")
    .insert({
      alert_type: "pipeline_health",
      severity,
      payload: {
        successRate,
        totalRuns,
        failed,
        avgTimeMs,
        p95TimeMs,
        avgCost,
      },
    })
    .select("id");

  if (insertError) {
    throw new Error(`Failed to insert system alert: ${insertError.message}`);
  }

  const alertId = (alertData?.[0]?.id as string) ?? "";

  return {
    alertId,
    summary: {
      successRate: Number((successRate * 100).toFixed(2)) + "%",
      totalRuns,
      failed,
      avgTimeMs,
      p95TimeMs,
      avgCost,
    },
  };
}
