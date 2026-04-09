/**
 * E5: Pipeline Health Monitor
 * Queries generation_runs for success/failure rates, avg time, cost trend.
 */

type SupabaseClient = { from: (table: string) => any };

export interface PipelineHealthResult {
  status: "green" | "amber" | "red";
  last24h: { total: number; succeeded: number; failed: number; avgTimeMs: number };
  daily7d: Array<{ date: string; succeeded: number; failed: number }>;
  recentErrors: Array<{ id: string; error: string; created_at: string }>;
  alerts: string[];
}

export async function checkPipelineHealth(supabase: SupabaseClient): Promise<PipelineHealthResult> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let runs24h: any[] = [];
  let runs7d: any[] = [];
  const alerts: string[] = [];

  try {
    const { data } = await supabase
      .from("generation_runs")
      .select("id, status, total_time_ms, error_message, created_at")
      .gte("created_at", h24)
      .order("created_at", { ascending: false });
    runs24h = data || [];
  } catch { /* table may not exist */ }

  try {
    const { data } = await supabase
      .from("generation_runs")
      .select("id, status, created_at")
      .gte("created_at", d7)
      .order("created_at", { ascending: false });
    runs7d = data || [];
  } catch { /* empty */ }

  const succeeded = runs24h.filter(r => r.status === "completed").length;
  const failed = runs24h.filter(r => r.status === "failed").length;
  const total = runs24h.length;
  const avgTimeMs = total > 0
    ? Math.round(runs24h.reduce((s, r) => s + (r.total_time_ms || 0), 0) / total)
    : 0;

  // 7-day daily breakdown
  const dailyMap = new Map<string, { succeeded: number; failed: number }>();
  for (const r of runs7d) {
    const day = r.created_at?.slice(0, 10) || "unknown";
    const entry = dailyMap.get(day) || { succeeded: 0, failed: 0 };
    if (r.status === "completed") entry.succeeded++;
    else if (r.status === "failed") entry.failed++;
    dailyMap.set(day, entry);
  }
  const daily7d = [...dailyMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Recent errors
  const recentErrors = runs24h
    .filter(r => r.status === "failed" && r.error_message)
    .slice(0, 5)
    .map(r => ({ id: r.id, error: r.error_message, created_at: r.created_at }));

  // Alerts
  if (total > 0 && failed / total > 0.3) alerts.push(`High failure rate: ${failed}/${total} in last 24h`);
  if (failed >= 5) alerts.push(`${failed} failed runs in last 24h`);

  const status: PipelineHealthResult["status"] =
    alerts.length > 0 ? (failed / Math.max(total, 1) > 0.5 ? "red" : "amber") : "green";

  return { status, last24h: { total, succeeded, failed, avgTimeMs }, daily7d, recentErrors, alerts };
}
