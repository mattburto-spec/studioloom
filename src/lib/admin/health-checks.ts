/**
 * E2: Health Summary Aggregator
 * Runs all monitors in parallel, aggregates into dashboard-ready data.
 */

import { checkPipelineHealth, type PipelineHealthResult } from "./monitors/pipeline-health";
import { checkCostAlerts, type CostAlertResult } from "./monitors/cost-alerts";
import { checkQualityDrift, type QualityDriftResult } from "./monitors/quality-drift";
import { checkEditTrackerSummary, type EditTrackerSummaryResult } from "./monitors/edit-tracker-summary";
import { checkStaleData, type StaleDataResult } from "./monitors/stale-watchdog";
import { checkUsageAnalytics, type UsageAnalyticsResult } from "./monitors/usage-analytics";

type SupabaseClient = { from: (table: string) => any };

export interface HealthSummary {
  pipeline: PipelineHealthResult;
  cost: CostAlertResult;
  quality: QualityDriftResult;
  edits: EditTrackerSummaryResult;
  stale: StaleDataResult;
  usage: UsageAnalyticsResult;
  overallAlerts: string[];
  sparklines: {
    runs: number[];
    cost: number[];
  };
}

export async function getHealthSummary(supabase: SupabaseClient): Promise<HealthSummary> {
  const [pipeline, cost, quality, edits, stale, usage] = await Promise.allSettled([
    checkPipelineHealth(supabase),
    checkCostAlerts(supabase),
    checkQualityDrift(supabase),
    checkEditTrackerSummary(supabase),
    checkStaleData(supabase),
    checkUsageAnalytics(supabase),
  ]);

  const p = pipeline.status === "fulfilled" ? pipeline.value : { status: "red" as const, last24h: { total: 0, succeeded: 0, failed: 0, avgTimeMs: 0 }, daily7d: [], recentErrors: [], alerts: ["Pipeline monitor failed"] };
  const c = cost.status === "fulfilled" ? cost.value : { status: "red" as const, todayUSD: 0, weekUSD: 0, monthUSD: 0, dailyBreakdown: [], alerts: ["Cost monitor failed"] };
  const q = quality.status === "fulfilled" ? quality.value : { status: "green" as const, thisWeekAvg: null, rollingAvg: null, drift: null, alerts: [] };
  const e = edits.status === "fulfilled" ? edits.value : { status: "green" as const, totalEdits: 0, mostEdited: [], mostDeleted: [], alerts: [] };
  const s = stale.status === "fulfilled" ? stale.value : { status: "green" as const, staleProfiles: 0, unscannedBlocks: 0, failedRunSpike: false, alerts: [] };
  const u = usage.status === "fulfilled" ? usage.value : { status: "green" as const, activeTeachers: 0, activeStudents: 0, totalUnits: 0, totalBlocks: 0, daily7d: [], alerts: [] };

  const overallAlerts = [...p.alerts, ...c.alerts, ...q.alerts, ...e.alerts, ...s.alerts, ...u.alerts];

  // Sparklines: last 7 days of runs and cost
  const runs = p.daily7d.map(d => d.succeeded + d.failed);
  const costLine = c.dailyBreakdown.slice(-7).map(d => d.usd);

  return { pipeline: p, cost: c, quality: q, edits: e, stale: s, usage: u, overallAlerts, sparklines: { runs, cost: costLine } };
}
