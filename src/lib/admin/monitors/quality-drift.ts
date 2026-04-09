/**
 * E5: Quality Drift Detector
 * Compares average Pulse scores this week vs 4-week rolling average.
 */

type SupabaseClient = { from: (table: string) => any };

export interface QualityDriftResult {
  status: "green" | "amber" | "red";
  thisWeekAvg: number | null;
  rollingAvg: number | null;
  drift: number | null;
  alerts: string[];
}

export async function checkQualityDrift(supabase: SupabaseClient): Promise<QualityDriftResult> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();

  let runs: any[] = [];
  try {
    const { data } = await supabase
      .from("generation_runs")
      .select("id, pulse_scores, created_at")
      .gte("created_at", d28)
      .eq("status", "completed");
    runs = data || [];
  } catch { /* empty */ }

  function getOverall(r: any): number | null {
    if (!r.pulse_scores) return null;
    if (typeof r.pulse_scores.overall === "number") return r.pulse_scores.overall;
    return null;
  }

  const thisWeekScores: number[] = [];
  const allScores: number[] = [];

  for (const r of runs) {
    const score = getOverall(r);
    if (score === null) continue;
    allScores.push(score);
    if (r.created_at >= d7) thisWeekScores.push(score);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const thisWeekAvg = avg(thisWeekScores);
  const rollingAvg = avg(allScores);
  const drift = thisWeekAvg !== null && rollingAvg !== null ? thisWeekAvg - rollingAvg : null;

  const alerts: string[] = [];
  if (drift !== null && drift < -1.0) {
    alerts.push(`Quality drift: this week ${thisWeekAvg!.toFixed(1)} vs rolling ${rollingAvg!.toFixed(1)} (Δ${drift.toFixed(1)})`);
  }

  const status: QualityDriftResult["status"] =
    drift !== null && drift < -2.0 ? "red" : drift !== null && drift < -1.0 ? "amber" : "green";

  return { status, thisWeekAvg, rollingAvg, drift, alerts };
}
