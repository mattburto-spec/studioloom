import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/access-v2/audit-log";

/**
 * Job 2: Cost Alert
 * Sum costs from generation_runs for today, this week, this month.
 * Compare against thresholds and debounce alerts.
 */
export async function run(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<{ alertId: string; summary: Record<string, unknown> }> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const dailyThreshold = parseFloat(process.env.COST_ALERT_DAILY_USD || "10");
  const weeklyThreshold = parseFloat(process.env.COST_ALERT_WEEKLY_USD || "50");
  const monthlyThreshold = parseFloat(process.env.COST_ALERT_MONTHLY_USD || "200");

  // Fetch costs for each period
  const [dailyRuns, weeklyRuns, monthlyRuns] = await Promise.all([
    supabase
      .from("generation_runs")
      .select("total_cost")
      .gte("created_at", todayStart),
    supabase
      .from("generation_runs")
      .select("total_cost")
      .gte("created_at", weekStart),
    supabase
      .from("generation_runs")
      .select("total_cost")
      .gte("created_at", monthStart),
  ]);

  // Helper to sum costs from runs
  function sumCosts(runs: unknown[]): number {
    let total = 0;
    for (const run of runs) {
      const cost = (run as { total_cost?: unknown })?.total_cost;
      if (cost && typeof cost === "object") {
        const costObj = cost as Record<string, unknown>;
        if (typeof costObj.total === "number") {
          total += costObj.total;
        }
      }
    }
    return total;
  }

  const dailyCost = sumCosts(dailyRuns.data ?? []);
  const weeklyCost = sumCosts(weeklyRuns.data ?? []);
  const monthlyCost = sumCosts(monthlyRuns.data ?? []);

  // Check thresholds
  const thresholdsExceeded = [];
  if (dailyCost > dailyThreshold) thresholdsExceeded.push("daily");
  if (weeklyCost > weeklyThreshold) thresholdsExceeded.push("weekly");
  if (monthlyCost > monthlyThreshold) thresholdsExceeded.push("monthly");

  // Debounce check: skip if warning exists in last 6h
  let shouldSkip = false;
  if (thresholdsExceeded.length > 0) {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: existingAlerts } = await supabase
      .from("system_alerts")
      .select("id")
      .eq("alert_type", "cost_alert")
      .eq("severity", "warning")
      .gte("created_at", sixHoursAgo)
      .limit(1);

    shouldSkip = (existingAlerts?.length ?? 0) > 0;
  }

  // Determine severity and write alert
  const severity = thresholdsExceeded.length > 0 ? "warning" : "info";
  const payload = {
    dailyCost: Number(dailyCost.toFixed(4)),
    weeklyCost: Number(weeklyCost.toFixed(4)),
    monthlyCost: Number(monthlyCost.toFixed(4)),
    dailyThreshold,
    weeklyThreshold,
    monthlyThreshold,
    thresholdsExceeded,
    debounced: shouldSkip,
  };

  let alertId = "";

  if (!shouldSkip) {
    const { data: alertData, error: insertError } = await supabase
      .from("system_alerts")
      .insert({
        alert_type: "cost_alert",
        severity,
        payload,
      })
      .select("id");

    if (insertError) {
      throw new Error(`Failed to insert cost alert: ${insertError.message}`);
    }

    alertId = (alertData?.[0]?.id as string) ?? "";
  }

  // Phase 6.7-followup — emit audit_event so the admin dashboard's "Vercel
  // Cron Jobs" panel can show the last-fired time. soft-warn: audit failure
  // mustn't break the cron run itself.
  await logAuditEvent(supabase, {
    actorId: null,
    actorType: "system",
    action: "cost.alert.run",
    severity: "info",
    payload: {
      alertId,
      ...payload,
    },
    failureMode: "soft-warn",
  });

  return {
    alertId,
    summary: payload,
  };
}
