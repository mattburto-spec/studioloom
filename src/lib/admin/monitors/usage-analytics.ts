/**
 * E5: Usage Analytics
 * Active teachers/students, total units/blocks, 7d daily breakdown.
 */

type SupabaseClient = { from: (table: string) => any };

export interface UsageAnalyticsResult {
  status: "green" | "amber" | "red";
  activeTeachers: number;
  activeStudents: number;
  totalUnits: number;
  totalBlocks: number;
  bugReportCount: number | null;
  daily7d: Array<{ date: string; runs: number; blocks: number }>;
  alerts: string[];
}

export async function checkUsageAnalytics(supabase: SupabaseClient): Promise<UsageAnalyticsResult> {
  let activeTeachers = 0;
  let activeStudents = 0;
  let totalUnits = 0;
  let totalBlocks = 0;
  const alerts: string[] = [];

  try {
    const { count } = await supabase
      .from("teacher_profiles")
      .select("id", { count: "exact", head: true });
    activeTeachers = count || 0;
  } catch { /* empty */ }

  try {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true });
    activeStudents = count || 0;
  } catch { /* empty */ }

  try {
    const { count } = await supabase
      .from("units")
      .select("id", { count: "exact", head: true });
    totalUnits = count || 0;
  } catch { /* empty */ }

  try {
    const { count } = await supabase
      .from("activity_blocks")
      .select("id", { count: "exact", head: true });
    totalBlocks = count || 0;
  } catch { /* empty */ }

  // Bug reports with status "new" or "investigating"
  let bugReportCount: number | null = null;
  try {
    const { count } = await supabase
      .from("bug_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "investigating"]);
    bugReportCount = count ?? 0;
  } catch { /* table may not exist yet */ }

  // 7d daily breakdown from generation_runs
  const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let runs7d: any[] = [];
  try {
    const { data } = await supabase
      .from("generation_runs")
      .select("id, created_at")
      .gte("created_at", d7);
    runs7d = data || [];
  } catch { /* empty */ }

  const dailyMap = new Map<string, { runs: number; blocks: number }>();
  for (const r of runs7d) {
    const day = r.created_at?.slice(0, 10) || "unknown";
    const entry = dailyMap.get(day) || { runs: 0, blocks: 0 };
    entry.runs++;
    dailyMap.set(day, entry);
  }
  const daily7d = [...dailyMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const status: UsageAnalyticsResult["status"] = "green";

  return { status, activeTeachers, activeStudents, totalUnits, totalBlocks, bugReportCount, daily7d, alerts };
}
