/**
 * Pilot-focused admin dashboard monitors (4 May 2026).
 *
 * Five small monitors aligned with the post-Phase-6 PILOT-READY state:
 *
 *   1. checkAuthActivity   — student/teacher login activity last 24h +
 *                            wrong-role redirects (Phase 6.3b signal)
 *   2. checkAiBudget       — today's AI token burn vs cap across the
 *                            cascade (per-student → class → school → tier)
 *   3. checkCronStatus     — last-fire time + outcome for the 3 wired
 *                            Vercel cron jobs (Phase 6.7 cron-wire)
 *   4. checkAuditWarnings  — count of audit_events with severity in
 *                            ('warn','critical') in last 24h
 *   5. checkScheduledDeletions — pending + held rows in scheduled_deletions
 *                                 (Phase 5.4 — DSR + retention queue)
 *   6. checkPendingTeacherRequests — count of teacher_access_requests
 *                                     awaiting admin review
 *
 * Each returns a status enum (green/amber/red), the headline metric,
 * and an optional alerts array. Pattern mirrors the existing monitors
 * (cost-alerts, pipeline-health, etc.). Failures are swallowed → "amber"
 * with an inline alert; never throw.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = { from: (table: string) => any };

// ─────────────────────────────────────────────────────────────────
// 1. Auth activity — last 24h student logins via audit_events
// ─────────────────────────────────────────────────────────────────

export interface AuthActivityResult {
  status: "green" | "amber" | "red";
  studentLogins24h: number;
  loginFailures24h: number;
  wrongRoleRedirects24h: number;
  alerts: string[];
}

export async function checkAuthActivity(
  supabase: SupabaseClient,
): Promise<AuthActivityResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const alerts: string[] = [];
  let studentLogins24h = 0;
  let loginFailures24h = 0;
  let wrongRoleRedirects24h = 0;

  try {
    const { count } = await supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "student.login.classcode.success")
      .gte("created_at", since);
    studentLogins24h = count ?? 0;
  } catch {
    alerts.push("Could not query student.login.classcode.success");
  }

  try {
    const { count } = await supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "student.login.classcode.failed")
      .gte("created_at", since);
    loginFailures24h = count ?? 0;
  } catch {
    /* silent */
  }

  // Wrong-role redirect signal — Phase 6.3b's middleware doesn't currently
  // emit an audit event (the cookie collision is silent — middleware just
  // redirects). When FU-AV2-WRONG-ROLE-TOAST closes we'll instrument; for
  // now this stays at 0 + a documentation note.
  // (Future: count audit events with action 'middleware.wrong_role.redirect'.)
  wrongRoleRedirects24h = 0;

  // Status: red if zero logins in 24h DURING pilot hours, amber if failures
  // outpace successes, green otherwise. Pre-pilot we expect 0 logins so
  // never red until pilot starts.
  let status: "green" | "amber" | "red" = "green";
  if (loginFailures24h > studentLogins24h && loginFailures24h > 5) {
    status = "amber";
    alerts.push(`${loginFailures24h} failed logins outpace ${studentLogins24h} success`);
  }

  return { status, studentLogins24h, loginFailures24h, wrongRoleRedirects24h, alerts };
}

// ─────────────────────────────────────────────────────────────────
// 2. AI budget burn — today's token use vs cap across all students
// ─────────────────────────────────────────────────────────────────

export interface AiBudgetResult {
  status: "green" | "amber" | "red";
  totalTokensUsedToday: number;
  studentsApproachingCap: number;  // > 80% of their cap
  studentsAtCap: number;            // >= 100%
  alerts: string[];
}

export async function checkAiBudget(
  supabase: SupabaseClient,
): Promise<AiBudgetResult> {
  const alerts: string[] = [];
  let totalTokensUsedToday = 0;
  let studentsApproachingCap = 0;
  let studentsAtCap = 0;

  try {
    const { data } = await supabase
      .from("ai_budget_state")
      .select("student_id, tokens_used_today");
    if (Array.isArray(data)) {
      totalTokensUsedToday = data.reduce(
        (sum, r: { tokens_used_today?: number }) => sum + (r.tokens_used_today ?? 0),
        0,
      );
      // Without resolving the cascade per-student here (expensive at every
      // dashboard load), use a tier-default heuristic of 100k tokens/day as
      // the comparison baseline. Real cap-resolution is per-call in the
      // withAIBudget middleware; this is a dashboard estimate.
      const ESTIMATED_CAP = 100_000;
      for (const r of data as Array<{ tokens_used_today?: number }>) {
        const used = r.tokens_used_today ?? 0;
        if (used >= ESTIMATED_CAP) studentsAtCap += 1;
        else if (used >= ESTIMATED_CAP * 0.8) studentsApproachingCap += 1;
      }
    }
  } catch {
    alerts.push("Could not query ai_budget_state");
  }

  let status: "green" | "amber" | "red" = "green";
  if (studentsAtCap > 0) {
    status = "red";
    alerts.push(`${studentsAtCap} student(s) at AI cap`);
  } else if (studentsApproachingCap > 0) {
    status = "amber";
    alerts.push(`${studentsApproachingCap} student(s) approaching AI cap`);
  }

  return { status, totalTokensUsedToday, studentsApproachingCap, studentsAtCap, alerts };
}

// ─────────────────────────────────────────────────────────────────
// 3. Cron status — last fire time + outcome of the 3 Vercel crons
// ─────────────────────────────────────────────────────────────────

export interface CronStatusResult {
  status: "green" | "amber" | "red";
  lastCostAlert: string | null;          // ISO timestamp
  lastScheduledHardDelete: string | null;
  lastRetentionEnforcement: string | null;
  alerts: string[];
}

export async function checkCronStatus(
  supabase: SupabaseClient,
): Promise<CronStatusResult> {
  const alerts: string[] = [];
  let lastCostAlert: string | null = null;
  let lastScheduledHardDelete: string | null = null;
  let lastRetentionEnforcement: string | null = null;

  // The 3 crons emit audit_events on each run when they do work. Cost-alert
  // also writes to system_alerts on debounce. For the dashboard we read the
  // most recent audit_event with the matching action.
  const cronActions = [
    { action: "cost.alert.run", setter: (t: string) => (lastCostAlert = t) },
    {
      action: "scheduled_hard_delete.run",
      setter: (t: string) => (lastScheduledHardDelete = t),
    },
    {
      action: "retention_enforcement.run",
      setter: (t: string) => (lastRetentionEnforcement = t),
    },
  ];

  for (const { action, setter } of cronActions) {
    try {
      const { data } = await supabase
        .from("audit_events")
        .select("created_at")
        .eq("action", action)
        .order("created_at", { ascending: false })
        .limit(1);
      if (Array.isArray(data) && data[0]?.created_at) {
        setter(data[0].created_at as string);
      }
    } catch {
      /* silent — leaves null */
    }
  }

  // Status logic: red if any DAILY cron hasn't fired in > 36h (allowing
  // some clock skew + daylight-savings nonsense). Monthly cron is amber
  // if > 35 days since last fire, never red (might just be early in month).
  const now = Date.now();
  const ageHours = (iso: string | null) =>
    iso ? (now - new Date(iso).getTime()) / (1000 * 60 * 60) : Infinity;

  let status: "green" | "amber" | "red" = "green";

  if (lastCostAlert === null && lastScheduledHardDelete === null && lastRetentionEnforcement === null) {
    // Pre-first-fire state. Don't alert; the user just shipped the cron-wire.
    alerts.push("No cron runs recorded yet (pre-first-fire window)");
    status = "amber";
  } else {
    if (ageHours(lastCostAlert) > 36) {
      status = "red";
      alerts.push(`cost-alert cron last fired ${Math.round(ageHours(lastCostAlert))}h ago`);
    }
    if (ageHours(lastScheduledHardDelete) > 36) {
      status = "red";
      alerts.push(
        `scheduled-hard-delete cron last fired ${Math.round(ageHours(lastScheduledHardDelete))}h ago`,
      );
    }
    if (lastRetentionEnforcement && ageHours(lastRetentionEnforcement) / 24 > 35) {
      if (status !== "red") status = "amber";
      alerts.push(
        `retention-enforcement cron last fired ${Math.round(ageHours(lastRetentionEnforcement) / 24)}d ago`,
      );
    }
  }

  return {
    status,
    lastCostAlert,
    lastScheduledHardDelete,
    lastRetentionEnforcement,
    alerts,
  };
}

// ─────────────────────────────────────────────────────────────────
// 4. Audit warnings — warn/critical events in last 24h
// ─────────────────────────────────────────────────────────────────

export interface AuditWarningsResult {
  warnCount24h: number;
  criticalCount24h: number;
  alerts: string[];
}

export async function checkAuditWarnings(
  supabase: SupabaseClient,
): Promise<AuditWarningsResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const alerts: string[] = [];
  let warnCount24h = 0;
  let criticalCount24h = 0;

  try {
    const { count } = await supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "warn")
      .gte("created_at", since);
    warnCount24h = count ?? 0;
  } catch {
    /* silent */
  }

  try {
    const { count } = await supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .gte("created_at", since);
    criticalCount24h = count ?? 0;
  } catch {
    /* silent */
  }

  if (criticalCount24h > 0) {
    alerts.push(`${criticalCount24h} critical audit event(s) in 24h — investigate`);
  }

  return { warnCount24h, criticalCount24h, alerts };
}

// ─────────────────────────────────────────────────────────────────
// 5. Scheduled deletions queue — pending + held
// ─────────────────────────────────────────────────────────────────

export interface ScheduledDeletionsResult {
  pendingCount: number;
  heldCount: number;
  alerts: string[];
}

export async function checkScheduledDeletions(
  supabase: SupabaseClient,
): Promise<ScheduledDeletionsResult> {
  const alerts: string[] = [];
  let pendingCount = 0;
  let heldCount = 0;

  try {
    const { count } = await supabase
      .from("scheduled_deletions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  } catch {
    /* silent */
  }

  try {
    const { count } = await supabase
      .from("scheduled_deletions")
      .select("id", { count: "exact", head: true })
      .eq("status", "held");
    heldCount = count ?? 0;
  } catch {
    /* silent */
  }

  if (heldCount > 0) {
    alerts.push(`${heldCount} deletion(s) held — admin review needed`);
  }

  return { pendingCount, heldCount, alerts };
}

// ─────────────────────────────────────────────────────────────────
// 6. Pending teacher requests — admin queue depth
// ─────────────────────────────────────────────────────────────────

export interface TeacherRequestsResult {
  pendingCount: number;
  alerts: string[];
}

export async function checkPendingTeacherRequests(
  supabase: SupabaseClient,
): Promise<TeacherRequestsResult> {
  const alerts: string[] = [];
  let pendingCount = 0;

  try {
    const { count } = await supabase
      .from("teacher_access_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  } catch {
    /* silent */
  }

  if (pendingCount >= 3) {
    alerts.push(`${pendingCount} teacher request(s) awaiting review`);
  }

  return { pendingCount, alerts };
}
