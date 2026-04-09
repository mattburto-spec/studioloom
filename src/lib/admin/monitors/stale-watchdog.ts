/**
 * E5: Stale Data Watchdog
 * Finds stale profiles, unscanned blocks, failed run spikes.
 */

type SupabaseClient = { from: (table: string) => any };

export interface StaleDataResult {
  status: "green" | "amber" | "red";
  staleProfiles: number;
  unscannedBlocks: number;
  failedRunSpike: boolean;
  alerts: string[];
}

export async function checkStaleData(supabase: SupabaseClient): Promise<StaleDataResult> {
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let staleProfiles = 0;
  let unscannedBlocks = 0;
  let failedRunSpike = false;
  const alerts: string[] = [];

  // Stale teacher profiles
  try {
    const { count } = await supabase
      .from("teacher_profiles")
      .select("id", { count: "exact", head: true })
      .lt("updated_at", sixMonthsAgo);
    staleProfiles = count || 0;
  } catch { /* empty */ }

  // Unscanned blocks (pii_scanned = false and older than 7 days)
  try {
    const { count } = await supabase
      .from("activity_blocks")
      .select("id", { count: "exact", head: true })
      .eq("pii_scanned", false)
      .lt("created_at", sevenDaysAgo);
    unscannedBlocks = count || 0;
  } catch { /* empty */ }

  // Failed run spike: >5 failures in last 24h
  try {
    const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("generation_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", h24);
    if ((count || 0) >= 5) failedRunSpike = true;
  } catch { /* empty */ }

  if (staleProfiles > 10) alerts.push(`${staleProfiles} teacher profiles not updated in 6+ months`);
  if (unscannedBlocks > 0) alerts.push(`${unscannedBlocks} blocks pending PII scan (7+ days old)`);
  if (failedRunSpike) alerts.push("Failed run spike: 5+ failures in last 24h");

  const status: StaleDataResult["status"] =
    failedRunSpike ? "red" : alerts.length > 0 ? "amber" : "green";

  return { status, staleProfiles, unscannedBlocks, failedRunSpike, alerts };
}
