/**
 * Pure aggregation helpers for Phase 6-4 fabrication history tabs.
 *
 * Both the per-student tab on `/teacher/students/[studentId]` and the
 * per-class section on `/teacher/classes/[classId]` share the same
 * summary-metric shape, so the math lives here and is tested once.
 *
 * Kept as a sibling `.ts` so tests don't need the `.tsx` transform.
 */

/**
 * Which `fabrication_jobs.status` values count as "passed" for
 * pass-rate computation. Per Phase 6 brief §9:
 *   "pass rate % (jobs reaching approved/completed / total jobs)"
 *
 * `picked_up` is included — that's "teacher approved AND lab tech has
 * the job in hand", which is a strict superset of `approved`. A job
 * can't reach picked_up without first passing through approved, and
 * it would be weird to count an approved-but-not-yet-picked-up job as
 * a pass but then uncount it when the lab tech grabs it.
 *
 * `rejected` and `cancelled` explicitly DO NOT count — neither
 * represents a successful submission from the student's perspective.
 */
export const PASSED_STATUSES: readonly string[] = [
  "approved",
  "picked_up",
  "completed",
];

/**
 * Which rule severities count toward the "top failure rule" ranking.
 * FYI rules are informational and by definition don't block or
 * coach, so they're excluded.
 */
export const FAILURE_SEVERITIES: readonly string[] = ["block", "warn"];

export interface HistoryJob {
  jobId: string;
  status: string;
  currentRevision: number;
  createdAt: string;
  /**
   * The failing rule ids fired on the CURRENT revision's scan. We use
   * current-revision only (not every revision) because a student's
   * last attempt is the most recent signal of what they struggle with.
   * Earlier revisions are already captured in the "revision count"
   * metric — double-counting would bias toward early-iteration rules.
   */
  currentRevisionFailingRuleIds: string[];
}

export interface HistorySummary {
  totalSubmissions: number;
  passed: number;
  /** 0–1. NaN-safe — returns 0 when totalSubmissions === 0. */
  passRate: number;
  /** Mean of `currentRevision` across all jobs; 0 on empty. */
  avgRevisions: number;
  /** Median so one 5-revision outlier doesn't blow the average. */
  medianRevisions: number;
  /** Most common block/warn rule across all current-revision scans. */
  topFailureRule: { ruleId: string; count: number } | null;
}

/**
 * Count "passed" jobs — used both for the summary and for per-student
 * drill-downs on the class view.
 */
export function countPassed(jobs: Pick<HistoryJob, "status">[]): number {
  return jobs.filter((j) => PASSED_STATUSES.includes(j.status)).length;
}

/**
 * Pass rate as a 0–1 float. Returns 0 (not NaN) for an empty list so
 * the UI can safely render `Math.round(passRate * 100) + '%'`.
 */
export function computePassRate(jobs: Pick<HistoryJob, "status">[]): number {
  if (jobs.length === 0) return 0;
  return countPassed(jobs) / jobs.length;
}

/**
 * Mean revision count. 0 on empty. Not rounded — the caller decides
 * display precision (the UI typically shows one decimal).
 */
export function computeAvgRevisions(
  jobs: Pick<HistoryJob, "currentRevision">[]
): number {
  if (jobs.length === 0) return 0;
  const sum = jobs.reduce((acc, j) => acc + j.currentRevision, 0);
  return sum / jobs.length;
}

/**
 * Median revision count. 0 on empty. Used alongside avg so an
 * outlier (student stuck on one job for 7 revisions) doesn't skew
 * the teacher's read.
 */
export function computeMedianRevisions(
  jobs: Pick<HistoryJob, "currentRevision">[]
): number {
  if (jobs.length === 0) return 0;
  const sorted = [...jobs].map((j) => j.currentRevision).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Find the single most common failing rule id across all jobs'
 * current-revision scan_results. Ties broken by first appearance
 * (stable insertion order). null when no failing rules anywhere.
 */
export function computeTopFailureRule(
  jobs: Pick<HistoryJob, "currentRevisionFailingRuleIds">[]
): { ruleId: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const ruleId of job.currentRevisionFailingRuleIds) {
      counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  let topId: string | null = null;
  let topCount = -1;
  for (const [ruleId, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topId = ruleId;
    }
  }
  return topId ? { ruleId: topId, count: topCount } : null;
}

/**
 * Single-pass summary builder — the shape the route returns and the
 * UI consumes. Pure; tested directly.
 */
export function buildHistorySummary(jobs: HistoryJob[]): HistorySummary {
  return {
    totalSubmissions: jobs.length,
    passed: countPassed(jobs),
    passRate: computePassRate(jobs),
    avgRevisions: computeAvgRevisions(jobs),
    medianRevisions: computeMedianRevisions(jobs),
    topFailureRule: computeTopFailureRule(jobs),
  };
}

/**
 * Extract failing rule ids from a raw scan_results blob. Used by the
 * orchestration layer to build HistoryJob rows. Tolerant of the blob
 * being null / undefined / missing `rules` — always returns string[].
 */
export function extractFailingRuleIds(
  scanResults:
    | { rules?: Array<{ id?: string; severity?: string }> | null }
    | null
    | undefined
): string[] {
  const out: string[] = [];
  for (const r of scanResults?.rules ?? []) {
    if (
      typeof r.id === "string" &&
      typeof r.severity === "string" &&
      FAILURE_SEVERITIES.includes(r.severity)
    ) {
      out.push(r.id);
    }
  }
  return out;
}

/**
 * Display formatter — "75%" / "—" (no jobs yet). Keeps the UI code
 * clean and tested in one place.
 */
export function formatPassRate(
  passRate: number,
  totalSubmissions: number
): string {
  if (totalSubmissions === 0) return "—";
  return `${Math.round(passRate * 100)}%`;
}

/**
 * Display formatter for avg revisions — "2.3" / "—".
 */
export function formatAvgRevisions(
  avg: number,
  totalSubmissions: number
): string {
  if (totalSubmissions === 0) return "—";
  return avg.toFixed(1);
}

/**
 * Phase 7-5d hotfix: terminal status + completion_status combine into
 * a single user-visible pill.
 *
 * Background: Phase 7 split the terminal `completed` status into two
 * sub-states via `fabrication_jobs.completion_status`:
 *   - printed / cut → run succeeded
 *   - failed        → run couldn't complete
 *
 * Early 7-1..7-5 built list views that rendered `status` alone, so a
 * `completed+failed` job mis-labelled as green "COMPLETED" on student
 * + teacher history tabs. This helper is the single source of truth
 * for the pill label + colour on any fabrication list view.
 *
 * Intentionally NOT overloaded for the detail page — that uses the
 * full LabTechCompletionCard and doesn't share this pill vocabulary.
 */
export interface FabricationStatusPill {
  /** UPPERCASE short label for the pill ("COMPLETED", "RUN FAILED", etc). */
  label: string;
  /** Tailwind pill class (`bg-... text-...`). */
  pillClass: string;
}

export function fabricationStatusPill(
  status: string,
  completionStatus: string | null | undefined
): FabricationStatusPill {
  // Split `completed` on the sub-status. This is the whole reason
  // the helper exists; everything else is a straight one-to-one.
  if (status === "completed") {
    if (completionStatus === "failed") {
      return {
        label: "RUN FAILED",
        pillClass: "bg-red-100 text-red-900",
      };
    }
    if (completionStatus === "printed") {
      return { label: "PRINTED", pillClass: "bg-green-100 text-green-900" };
    }
    if (completionStatus === "cut") {
      return { label: "CUT", pillClass: "bg-green-100 text-green-900" };
    }
    // Legacy rows with no completion_status (pre-7-5) land here.
    // Treat as succeeded — that's the backward-compatible read and
    // nobody printed anything "failed" before the failure sub-state
    // existed in code.
    return { label: "COMPLETED", pillClass: "bg-green-100 text-green-900" };
  }

  switch (status) {
    case "approved":
      return { label: "APPROVED", pillClass: "bg-green-100 text-green-900" };
    case "pending_approval":
      return {
        label: "PENDING APPROVAL",
        pillClass: "bg-amber-100 text-amber-900",
      };
    case "needs_revision":
      return {
        label: "NEEDS REVISION",
        pillClass: "bg-orange-100 text-orange-900",
      };
    case "rejected":
      return { label: "REJECTED", pillClass: "bg-red-100 text-red-900" };
    case "cancelled":
      return { label: "CANCELLED", pillClass: "bg-red-100 text-red-900" };
    case "uploaded":
      return { label: "UPLOADED", pillClass: "bg-blue-100 text-blue-900" };
    case "scanning":
      return { label: "SCANNING", pillClass: "bg-blue-100 text-blue-900" };
    case "picked_up":
      return { label: "IN PROGRESS", pillClass: "bg-purple-100 text-purple-900" };
    default:
      return {
        label: status.toUpperCase().replace(/_/g, " "),
        pillClass: "bg-gray-100 text-gray-900",
      };
  }
}
