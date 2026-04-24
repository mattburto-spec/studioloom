"use client";

/**
 * StudentFabricationHistory — Phase 6-4 fabrication tab body.
 *
 * Mounted on `/teacher/students/[studentId]` when the teacher clicks
 * the "Fabrication" tab. Fetches
 * `GET /api/teacher/fabrication/students/[studentId]/history` and
 * renders summary metric cards + a chronological list of submissions
 * (each row links to the Phase 6-2 detail page).
 *
 * The class-view counterpart (ClassFabricationHistorySection) reuses
 * the same summary-card row and job-list row; see that file for the
 * per-student drill-down table it adds on top.
 */

import * as React from "react";
import Link from "next/link";
import {
  formatPassRate,
  formatAvgRevisions,
} from "./fabrication-history-helpers";
import {
  formatRuleCountsCompact,
  formatDateTime,
} from "./revision-history-helpers";
import type {
  HistorySuccess,
  HistoryJobRow,
  HistorySummaryPayload,
} from "@/lib/fabrication/teacher-orchestration";

export interface StudentFabricationHistoryProps {
  studentId: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: HistorySuccess };

export function StudentFabricationHistory({
  studentId,
}: StudentFabricationHistoryProps) {
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/teacher/fabrication/students/${studentId}/history`,
          { credentials: "same-origin" }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          if (!cancelled) {
            setState({
              kind: "error",
              message:
                body.error ||
                `Couldn't load fabrication history (HTTP ${res.status})`,
            });
          }
          return;
        }
        const data = (await res.json()) as HistorySuccess;
        if (!cancelled) setState({ kind: "ready", data });
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : "Network error",
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-3 py-10 justify-center">
        <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-600">Loading fabrication history…</span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-900">{state.message}</p>
      </div>
    );
  }

  const { summary, jobs } = state.data;

  return (
    <div className="space-y-5">
      <HistorySummaryCards summary={summary} />

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">
            This student hasn&apos;t submitted anything to fabricate yet.
          </p>
        </div>
      ) : (
        // Student scope: hide redundant student-name column, surface
        // class name as a chip since the student may be enrolled in
        // multiple classes. Phase 6-6n.
        <HistoryJobList
          jobs={jobs}
          showStudentColumn={false}
          showClassColumn
        />
      )}
    </div>
  );
}

/**
 * 4-card summary strip. Used by both student + class views; kept
 * exported so ClassFabricationHistorySection can reuse it.
 */
export function HistorySummaryCards({
  summary,
}: {
  summary: HistorySummaryPayload;
}) {
  const total = summary.totalSubmissions;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard label="Total submissions" value={String(total)} />
      <MetricCard
        label="Pass rate"
        value={formatPassRate(summary.passRate, total)}
        hint={total > 0 ? `${summary.passed} / ${total} approved` : undefined}
      />
      <MetricCard
        label="Avg revisions"
        value={formatAvgRevisions(summary.avgRevisions, total)}
        hint={
          total > 0 ? `median ${summary.medianRevisions.toFixed(1)}` : undefined
        }
      />
      <MetricCard
        label="Top failure rule"
        value={summary.topFailureRule?.ruleId ?? "—"}
        hint={
          summary.topFailureRule
            ? `${summary.topFailureRule.count} job${
                summary.topFailureRule.count === 1 ? "" : "s"
              }`
            : total > 0
              ? "none firing"
              : undefined
        }
        valueIsMono
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  valueIsMono,
}: {
  label: string;
  value: string;
  hint?: string;
  valueIsMono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold text-gray-900 ${
          valueIsMono ? "font-mono text-lg" : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/**
 * Chronological job list — each row links to the Phase 6-2 detail
 * page.
 *
 *   showStudentColumn — on for class-scope (multiple students contribute
 *                       to the list); off for per-student page.
 *   showClassColumn   — on for per-student-scope (student may be enrolled
 *                       in multiple classes); off for class-scope (all
 *                       rows share the same class, column would be
 *                       redundant). Phase 6-6n.
 */
export function HistoryJobList({
  jobs,
  showStudentColumn,
  showClassColumn = false,
}: {
  jobs: HistoryJobRow[];
  showStudentColumn: boolean;
  showClassColumn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <ul className="divide-y divide-gray-100">
        {jobs.map((j) => (
          <HistoryJobRowItem
            key={j.jobId}
            row={j}
            showStudent={showStudentColumn}
            showClass={showClassColumn}
          />
        ))}
      </ul>
    </div>
  );
}

function HistoryJobRowItem({
  row,
  showStudent,
  showClass,
}: {
  row: HistoryJobRow;
  showStudent: boolean;
  showClass: boolean;
}) {
  const counts = formatRuleCountsCompact(row.ruleCounts);
  const submittedAt = formatDateTime(row.createdAt);
  const pill = statusPillClass(row.status);

  return (
    <li>
      <Link
        href={`/teacher/preflight/jobs/${row.jobId}`}
        className="flex items-center gap-3 p-3 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {showStudent && row.studentName && (
              <span className="font-semibold text-gray-900 truncate">
                {row.studentName}
              </span>
            )}
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${pill}`}
            >
              {row.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-gray-500">Rev {row.currentRevision}</span>
            {counts ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                {counts}
              </span>
            ) : (
              <span className="text-xs text-green-700">clean</span>
            )}
            {showClass && row.className && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-brand-purple/10 text-brand-purple font-semibold">
                {row.className}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">
            {row.machineLabel}
            {row.unitTitle && ` · ${row.unitTitle}`}
            {" · "}
            <code className="font-mono">{row.originalFilename}</code>
          </p>
        </div>
        <div className="text-xs text-gray-500 whitespace-nowrap shrink-0">
          {submittedAt}
        </div>
      </Link>
    </li>
  );
}

function statusPillClass(status: string): string {
  switch (status) {
    case "approved":
    case "completed":
      return "bg-green-100 text-green-900";
    case "pending_approval":
      return "bg-amber-100 text-amber-900";
    case "needs_revision":
      return "bg-orange-100 text-orange-900";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-900";
    case "uploaded":
    case "scanning":
      return "bg-blue-100 text-blue-900";
    case "picked_up":
      return "bg-purple-100 text-purple-900";
    default:
      return "bg-gray-100 text-gray-900";
  }
}

export default StudentFabricationHistory;
