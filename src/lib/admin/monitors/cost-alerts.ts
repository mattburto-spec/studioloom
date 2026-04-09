/**
 * E5: Cost Alert System
 * Daily/weekly/monthly spend, spike detection.
 */

type SupabaseClient = { from: (table: string) => any };

export interface CostAlertResult {
  status: "green" | "amber" | "red";
  todayUSD: number;
  weekUSD: number;
  monthUSD: number;
  dailyBreakdown: Array<{ date: string; usd: number }>;
  alerts: string[];
}

export async function checkCostAlerts(supabase: SupabaseClient): Promise<CostAlertResult> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let runs: any[] = [];
  try {
    const { data } = await supabase
      .from("generation_runs")
      .select("id, total_cost, created_at")
      .gte("created_at", d30)
      .order("created_at", { ascending: false });
    runs = data || [];
  } catch { /* empty */ }

  function getCost(r: any): number {
    if (!r.total_cost) return 0;
    if (typeof r.total_cost === "number") return r.total_cost;
    return r.total_cost.totalUSD || r.total_cost.estimatedCostUSD || 0;
  }

  let todayUSD = 0;
  let weekUSD = 0;
  let monthUSD = 0;
  const dailyMap = new Map<string, number>();

  for (const r of runs) {
    const cost = getCost(r);
    const day = r.created_at?.slice(0, 10) || "unknown";
    monthUSD += cost;
    if (r.created_at >= d7) weekUSD += cost;
    if (r.created_at >= todayStart) todayUSD += cost;
    dailyMap.set(day, (dailyMap.get(day) || 0) + cost);
  }

  const dailyBreakdown = [...dailyMap.entries()]
    .map(([date, usd]) => ({ date, usd: Math.round(usd * 1000) / 1000 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const alerts: string[] = [];
  // Spike: today > 3x 7d avg
  const avgDaily = dailyBreakdown.length > 1
    ? weekUSD / Math.min(dailyBreakdown.length, 7)
    : 0;
  if (todayUSD > 10) alerts.push(`Daily spend $${todayUSD.toFixed(2)} exceeds $10 threshold`);
  if (avgDaily > 0 && todayUSD > avgDaily * 3) alerts.push(`Today's spend is ${(todayUSD / avgDaily).toFixed(1)}x the 7-day average`);

  const status: CostAlertResult["status"] =
    alerts.length >= 2 ? "red" : alerts.length >= 1 ? "amber" : "green";

  return {
    status,
    todayUSD: Math.round(todayUSD * 100) / 100,
    weekUSD: Math.round(weekUSD * 100) / 100,
    monthUSD: Math.round(monthUSD * 100) / 100,
    dailyBreakdown,
    alerts,
  };
}
