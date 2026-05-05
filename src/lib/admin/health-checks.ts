/**
 * E2: Health Summary Aggregator
 * Runs all monitors in parallel, aggregates into dashboard-ready data.
 *
 * Phase 6.7+ refresh (4 May 2026): added 6 pilot-focused monitors
 * (auth activity, AI budget burn, cron status, audit warnings,
 * scheduled deletions queue, pending teacher requests). The legacy
 * pipeline + library + edits + stale fields stay in the response shape
 * for backward-compat with tests + the cost-usage page, but the
 * Dashboard UI is moving to the new fields.
 */

import { checkPipelineHealth, type PipelineHealthResult } from "./monitors/pipeline-health";
import { checkCostAlerts, type CostAlertResult } from "./monitors/cost-alerts";
import { checkQualityDrift, type QualityDriftResult } from "./monitors/quality-drift";
import { checkEditTrackerSummary, type EditTrackerSummaryResult } from "./monitors/edit-tracker-summary";
import { checkStaleData, type StaleDataResult } from "./monitors/stale-watchdog";
import { checkUsageAnalytics, type UsageAnalyticsResult } from "./monitors/usage-analytics";
import {
  checkAuthActivity,
  checkAiBudget,
  checkCronStatus,
  checkAuditWarnings,
  checkScheduledDeletions,
  checkPendingTeacherRequests,
  type AuthActivityResult,
  type AiBudgetResult,
  type CronStatusResult,
  type AuditWarningsResult,
  type ScheduledDeletionsResult,
  type TeacherRequestsResult,
} from "./monitors/pilot-monitors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = { from: (table: string) => any };

export interface HealthSummary {
  pipeline: PipelineHealthResult;
  cost: CostAlertResult;
  quality: QualityDriftResult;
  edits: EditTrackerSummaryResult;
  stale: StaleDataResult;
  usage: UsageAnalyticsResult;
  // Phase 6.7+ pilot-focused monitors
  auth: AuthActivityResult;
  aiBudget: AiBudgetResult;
  crons: CronStatusResult;
  auditWarnings: AuditWarningsResult;
  scheduledDeletions: ScheduledDeletionsResult;
  pendingTeacherRequests: TeacherRequestsResult;
  overallAlerts: string[];
  sparklines: {
    runs: number[];
    cost: number[];
  };
}

export async function getHealthSummary(supabase: SupabaseClient): Promise<HealthSummary> {
  const [
    pipeline, cost, quality, edits, stale, usage,
    auth, aiBudget, crons, auditWarnings, scheduledDeletions, pendingTeacherRequests,
  ] = await Promise.allSettled([
    checkPipelineHealth(supabase),
    checkCostAlerts(supabase),
    checkQualityDrift(supabase),
    checkEditTrackerSummary(supabase),
    checkStaleData(supabase),
    checkUsageAnalytics(supabase),
    checkAuthActivity(supabase),
    checkAiBudget(supabase),
    checkCronStatus(supabase),
    checkAuditWarnings(supabase),
    checkScheduledDeletions(supabase),
    checkPendingTeacherRequests(supabase),
  ]);

  const p = pipeline.status === "fulfilled" ? pipeline.value : { status: "red" as const, last24h: { total: 0, succeeded: 0, failed: 0, avgTimeMs: 0 }, daily7d: [], recentErrors: [], alerts: ["Pipeline monitor failed"] };
  const c = cost.status === "fulfilled" ? cost.value : { status: "red" as const, todayUSD: 0, weekUSD: 0, monthUSD: 0, dailyBreakdown: [], alerts: ["Cost monitor failed"] };
  const q = quality.status === "fulfilled" ? quality.value : { status: "green" as const, thisWeekAvg: null, rollingAvg: null, drift: null, alerts: [] };
  const e = edits.status === "fulfilled" ? edits.value : { status: "green" as const, totalEdits: 0, mostEdited: [], mostDeleted: [], alerts: [] };
  const s = stale.status === "fulfilled" ? stale.value : { status: "green" as const, staleProfiles: 0, unscannedBlocks: 0, failedRunSpike: false, alerts: [] };
  const u = usage.status === "fulfilled" ? usage.value : { status: "green" as const, activeTeachers: 0, activeStudents: 0, totalUnits: 0, totalBlocks: 0, bugReportCount: null, daily7d: [], alerts: [] };
  const a = auth.status === "fulfilled" ? auth.value : { status: "amber" as const, studentLogins24h: 0, loginFailures24h: 0, wrongRoleRedirects24h: 0, alerts: ["Auth monitor failed"] };
  const ab = aiBudget.status === "fulfilled" ? aiBudget.value : { status: "amber" as const, totalTokensUsedToday: 0, studentsApproachingCap: 0, studentsAtCap: 0, alerts: ["AI budget monitor failed"] };
  const cr = crons.status === "fulfilled" ? crons.value : { status: "amber" as const, lastCostAlert: null, lastScheduledHardDelete: null, lastRetentionEnforcement: null, alerts: ["Cron monitor failed"] };
  const aw = auditWarnings.status === "fulfilled" ? auditWarnings.value : { warnCount24h: 0, criticalCount24h: 0, alerts: [] };
  const sd = scheduledDeletions.status === "fulfilled" ? scheduledDeletions.value : { pendingCount: 0, heldCount: 0, alerts: [] };
  const ptr = pendingTeacherRequests.status === "fulfilled" ? pendingTeacherRequests.value : { pendingCount: 0, alerts: [] };

  const overallAlerts = [
    ...c.alerts, ...q.alerts, ...s.alerts,
    ...a.alerts, ...ab.alerts, ...cr.alerts, ...aw.alerts, ...sd.alerts, ...ptr.alerts,
    // Pipeline + edits alerts kept out of overall — Dimensions3 quarantined,
    // their noise was the main reason the alerts feed felt useless pre-pilot.
  ];

  // Sparklines: last 7 days of runs and cost
  const runs = p.daily7d.map(d => d.succeeded + d.failed);
  const costLine = c.dailyBreakdown.slice(-7).map(d => d.usd);

  return {
    pipeline: p, cost: c, quality: q, edits: e, stale: s, usage: u,
    auth: a, aiBudget: ab, crons: cr,
    auditWarnings: aw, scheduledDeletions: sd, pendingTeacherRequests: ptr,
    overallAlerts,
    sparklines: { runs, cost: costLine },
  };
}
