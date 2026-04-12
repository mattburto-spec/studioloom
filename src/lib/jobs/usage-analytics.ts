import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Job 7: Usage Analytics
 * Roll up daily usage into usage_rollups table with UPSERT.
 */
export async function run(
  supabase: SupabaseClient
): Promise<{ alertId: string; summary: Record<string, unknown> }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodStart = today.toISOString().split("T")[0];

  // Count generation_runs per teacher (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: teacherRuns, error: runsError } = await supabase
    .from("generation_runs")
    .select("teacher_id")
    .gte("created_at", oneDayAgo);

  if (runsError) {
    throw new Error(`Failed to fetch generation runs: ${runsError.message}`);
  }

  // Count student_progress entries (last 24h)
  const { count: progressCount } = await supabase
    .from("student_progress")
    .select("*", { count: "exact", head: true })
    .gte("created_at", oneDayAgo);

  // Total blocks in library (non-archived)
  const { count: totalBlocks } = await supabase
    .from("activity_blocks")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false);

  // Aggregate generation_runs by teacher
  const teacherCounts = new Map<string, number>();
  for (const run of teacherRuns ?? []) {
    const teacherId = (run.teacher_id as string) || "unknown";
    teacherCounts.set(teacherId, (teacherCounts.get(teacherId) ?? 0) + 1);
  }

  // UPSERT rollups for each teacher
  const rollups: Array<{
    period_type: string;
    period_start: string;
    teacher_id: string | null;
    student_id: null;
    metrics: Record<string, unknown>;
  }> = Array.from(teacherCounts.entries()).map(([teacher_id, count]) => ({
    period_type: "daily",
    period_start: periodStart,
    teacher_id,
    student_id: null,
    metrics: {
      generation_runs: count,
      total_blocks: totalBlocks,
    },
  }));

  // Also add overall rollup (no teacher_id)
  rollups.push({
    period_type: "daily",
    period_start: periodStart,
    teacher_id: null,
    student_id: null,
    metrics: {
      generation_runs_total: teacherRuns?.length ?? 0,
      student_progress_created: progressCount ?? 0,
      total_blocks_in_library: totalBlocks ?? 0,
    },
  });

  // UPSERT all rollups
  const { error: upsertError } = await supabase
    .from("usage_rollups")
    .upsert(rollups, {
      onConflict: "period_type,period_start,teacher_id,student_id",
    });

  if (upsertError) {
    throw new Error(`Failed to upsert rollups: ${upsertError.message}`);
  }

  // Write summary to system_alerts
  const { data: alertData, error: insertError } = await supabase
    .from("system_alerts")
    .insert({
      alert_type: "usage_analytics",
      severity: "info",
      payload: {
        period: periodStart,
        teachersActive: teacherCounts.size,
        generationRunsLast24h: teacherRuns?.length ?? 0,
        progressCreatedLast24h: progressCount ?? 0,
        totalBlocksInLibrary: totalBlocks ?? 0,
        rollupsWritten: rollups.length,
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
      period: periodStart,
      teachersActive: teacherCounts.size,
      generationRunsLast24h: teacherRuns?.length ?? 0,
      progressCreatedLast24h: progressCount ?? 0,
      totalBlocksInLibrary: totalBlocks ?? 0,
      rollupsWritten: rollups.length,
    },
  };
}
