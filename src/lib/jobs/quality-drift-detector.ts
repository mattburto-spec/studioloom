import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Job 3: Quality Drift Detector
 * Compare quality scores from last 7 days vs prior 30 days.
 * Alert if drop > 10%.
 */
export async function run(
  supabase: SupabaseClient
): Promise<{ alertId: string; summary: Record<string, unknown> }> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtySevenDaysAgo = new Date(now.getTime() - 37 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch recent runs (last 7 days)
  const { data: recentRuns, error: recentError } = await supabase
    .from("generation_runs")
    .select("quality_report")
    .gte("created_at", sevenDaysAgo);

  if (recentError) {
    throw new Error(`Failed to fetch recent runs: ${recentError.message}`);
  }

  // Fetch prior runs (days 8-37)
  const { data: priorRuns, error: priorError } = await supabase
    .from("generation_runs")
    .select("quality_report")
    .gte("created_at", thirtySevenDaysAgo)
    .lt("created_at", thirtyDaysAgo);

  if (priorError) {
    throw new Error(`Failed to fetch prior runs: ${priorError.message}`);
  }

  // Helper to extract score from quality_report
  function extractScore(report: unknown): number | null {
    if (!report || typeof report !== "object") return null;
    const reportObj = report as Record<string, unknown>;
    if (typeof reportObj.pulse_score === "number") return reportObj.pulse_score;
    if (typeof reportObj.overall_score === "number") return reportObj.overall_score;
    return null;
  }

  // Compute averages
  const recentScores = (recentRuns ?? [])
    .map((r) => extractScore(r.quality_report))
    .filter((s): s is number => s !== null);

  const priorScores = (priorRuns ?? [])
    .map((r) => extractScore(r.quality_report))
    .filter((s): s is number => s !== null);

  // If insufficient data, return info alert
  if (recentScores.length === 0 || priorScores.length === 0) {
    const { data: alertData, error: insertError } = await supabase
      .from("system_alerts")
      .insert({
        alert_type: "quality_drift",
        severity: "info",
        payload: {
          message: "insufficient data",
          recentSampleSize: recentScores.length,
          priorSampleSize: priorScores.length,
        },
      })
      .select("id");

    if (insertError) {
      throw new Error(`Failed to insert alert: ${insertError.message}`);
    }

    const alertId = (alertData?.[0]?.id as string) ?? "";
    return {
      alertId,
      summary: {
        status: "insufficient_data",
        recentSampleSize: recentScores.length,
        priorSampleSize: priorScores.length,
      },
    };
  }

  const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const priorAvg = priorScores.reduce((a, b) => a + b, 0) / priorScores.length;
  const dropPercent = priorAvg > 0 ? ((priorAvg - recentAvg) / priorAvg) * 100 : 0;

  // Determine severity
  const severity = dropPercent > 10 ? "warning" : "info";

  const { data: alertData, error: insertError } = await supabase
    .from("system_alerts")
    .insert({
      alert_type: "quality_drift",
      severity,
      payload: {
        recentAvg: Number(recentAvg.toFixed(2)),
        priorAvg: Number(priorAvg.toFixed(2)),
        dropPercent: Number(dropPercent.toFixed(2)),
      },
    })
    .select("id");

  if (insertError) {
    throw new Error(`Failed to insert alert: ${insertError.message}`);
  }

  const alertId = (alertData?.[0]?.id as string) ?? "";

  return {
    alertId,
    summary: {
      recentAvg: Number(recentAvg.toFixed(2)),
      priorAvg: Number(priorAvg.toFixed(2)),
      dropPercent: Number(dropPercent.toFixed(2)),
      severity,
    },
  };
}
