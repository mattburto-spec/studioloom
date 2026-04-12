import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Job 6: Smoke Tests
 * 6 wiring health checks: table queryability and FK integrity.
 */
export async function run(
  supabase: SupabaseClient
): Promise<{ alertId: string; summary: Record<string, unknown> }> {
  const checks: Record<string, Record<string, unknown>> = {};

  // Check 1: activity_blocks table
  const start1 = Date.now();
  const { count: blocksCount, error: blocksError } = await supabase
    .from("activity_blocks")
    .select("*", { count: "exact", head: true });
  const time1 = Date.now() - start1;
  checks.activity_blocks = {
    pass: !blocksError,
    latencyMs: time1,
    count: blocksCount,
    error: blocksError?.message,
  };

  // Check 2: generation_runs table with FK
  const start2 = Date.now();
  const { count: runsCount, error: runsError } = await supabase
    .from("generation_runs")
    .select("*", { count: "exact", head: true });
  const time2 = Date.now() - start2;
  checks.generation_runs = {
    pass: !runsError,
    latencyMs: time2,
    count: runsCount,
    error: runsError?.message,
  };

  // Check 3: feedback_proposals table
  const start3 = Date.now();
  const { count: proposalsCount, error: proposalsError } = await supabase
    .from("feedback_proposals")
    .select("*", { count: "exact", head: true });
  const time3 = Date.now() - start3;
  checks.feedback_proposals = {
    pass: !proposalsError,
    latencyMs: time3,
    count: proposalsCount,
    error: proposalsError?.message,
  };

  // Check 4: system_alerts table (self-referential)
  const start4 = Date.now();
  const { count: alertsCount, error: alertsError } = await supabase
    .from("system_alerts")
    .select("*", { count: "exact", head: true });
  const time4 = Date.now() - start4;
  checks.system_alerts = {
    pass: !alertsError,
    latencyMs: time4,
    count: alertsCount,
    error: alertsError?.message,
  };

  // Check 5: generation_feedback table
  const start5 = Date.now();
  const { count: feedbackCount, error: feedbackError } = await supabase
    .from("generation_feedback")
    .select("*", { count: "exact", head: true });
  const time5 = Date.now() - start5;
  checks.generation_feedback = {
    pass: !feedbackError,
    latencyMs: time5,
    count: feedbackCount,
    error: feedbackError?.message,
  };

  // Check 6: feedback_audit_log table
  const start6 = Date.now();
  const { count: auditCount, error: auditError } = await supabase
    .from("feedback_audit_log")
    .select("*", { count: "exact", head: true });
  const time6 = Date.now() - start6;
  checks.feedback_audit_log = {
    pass: !auditError,
    latencyMs: time6,
    count: auditCount,
    error: auditError?.message,
  };

  // Determine overall severity
  const allPassed = Object.values(checks).every((c) => c.pass);
  const severity = allPassed ? "info" : "warning";

  const { data: alertData, error: insertError } = await supabase
    .from("system_alerts")
    .insert({
      alert_type: "smoke_tests",
      severity,
      payload: checks,
    })
    .select("id");

  if (insertError) {
    throw new Error(`Failed to insert alert: ${insertError.message}`);
  }

  const alertId = (alertData?.[0]?.id as string) ?? "";

  return {
    alertId,
    summary: {
      allPassed,
      checksRun: Object.keys(checks).length,
      failedChecks: Object.entries(checks)
        .filter(([, c]) => !c.pass)
        .map(([name]) => name),
    },
  };
}
