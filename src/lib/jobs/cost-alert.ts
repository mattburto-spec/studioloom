import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/access-v2/audit-log";

/**
 * Job 2: Cost Alert
 * Sum estimated_cost_usd from ai_usage_log for today, this week, this month.
 * Compare against thresholds and debounce alerts.
 *
 * Source of truth: ai_usage_log. Post-Phase-A (8 May 2026) every Anthropic
 * call routes through callAnthropicMessages() → logUsage(), so this table
 * captures the full bill — generation pipeline, student mentoring, toolkit
 * tools, free tools, Report Writer, etc. generation_runs.total_cost was the
 * old single-source view; it's now a subset that double-counts with the log.
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

  // Fetch costs for each period from ai_usage_log
  const [dailyRows, weeklyRows, monthlyRows] = await Promise.all([
    supabase
      .from("ai_usage_log")
      .select("estimated_cost_usd")
      .gte("created_at", todayStart),
    supabase
      .from("ai_usage_log")
      .select("estimated_cost_usd")
      .gte("created_at", weekStart),
    supabase
      .from("ai_usage_log")
      .select("estimated_cost_usd")
      .gte("created_at", monthStart),
  ]);

  // Helper to sum estimated_cost_usd from rows
  function sumCosts(rows: unknown[]): number {
    let total = 0;
    for (const row of rows) {
      const cost = (row as { estimated_cost_usd?: unknown })?.estimated_cost_usd;
      // numeric(10,6) comes back as a string from PostgREST
      const n = typeof cost === "string" ? parseFloat(cost) : typeof cost === "number" ? cost : 0;
      if (Number.isFinite(n)) total += n;
    }
    return total;
  }

  const dailyCost = sumCosts(dailyRows.data ?? []);
  const weeklyCost = sumCosts(weeklyRows.data ?? []);
  const monthlyCost = sumCosts(monthlyRows.data ?? []);

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
