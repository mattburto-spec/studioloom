import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Job 5: Stale Data Watchdog
 * Check for: NULL embeddings, stale last_used_at, failed runs, old teacher profiles.
 */
export async function run(
  supabase: SupabaseClient
): Promise<{ alertId: string; summary: Record<string, unknown> }> {
  const issues: Record<string, unknown> = {};

  // Check 1: Blocks with NULL embedding
  const { count: nullEmbeddingCount, error: embError } = await supabase
    .from("activity_blocks")
    .select("*", { count: "exact", head: true })
    .is("embedding", null);

  if (!embError) {
    issues.nullEmbeddingCount = nullEmbeddingCount ?? 0;
  }

  // Check 2: Blocks with stale last_used_at (>90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: staleCount, error: staleError } = await supabase
    .from("activity_blocks")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false)
    .or(`last_used_at.lt.${ninetyDaysAgo},last_used_at.is.null`);

  if (!staleError) {
    issues.staleBlockCount = staleCount ?? 0;
  }

  // Check 3: Failed runs in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: failedCount, error: failedError } = await supabase
    .from("generation_runs")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", oneDayAgo);

  if (!failedError) {
    issues.failedRunsLast24h = failedCount ?? 0;
    issues.failedRunsSpike = (failedCount ?? 0) > 3;
  }

  // Check 4: Teacher style profiles not updated in 6 months
  // Gracefully handle if table doesn't exist
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { count: oldProfileCount, error: profileError } = await supabase
    .from("teacher_style_profiles")
    .select("*", { count: "exact", head: true })
    .lt("updated_at", sixMonthsAgo);

  if (!profileError) {
    issues.oldTeacherProfiles = oldProfileCount ?? 0;
  }

  // Determine severity
  const hasIssues =
    (issues.nullEmbeddingCount as number) > 0 ||
    (issues.staleBlockCount as number) > 0 ||
    issues.failedRunsSpike ||
    (issues.oldTeacherProfiles as number) > 0;

  const severity = hasIssues ? "warning" : "info";

  const { data: alertData, error: insertError } = await supabase
    .from("system_alerts")
    .insert({
      alert_type: "stale_data",
      severity,
      payload: issues,
    })
    .select("id");

  if (insertError) {
    throw new Error(`Failed to insert alert: ${insertError.message}`);
  }

  const alertId = (alertData?.[0]?.id as string) ?? "";

  return {
    alertId,
    summary: {
      ...issues,
      severity,
      hasIssues,
    },
  };
}
