"use client";

/**
 * /fabrication — Student-side Preflight overview (Phase 6-6i).
 *
 * Lands students on a list of all their existing fabrication
 * submissions so they can check status, open an in-flight job, or
 * start a new submission. Parallel to the teacher-side
 * `/teacher/preflight` queue but scoped to the authenticated
 * student's own jobs only.
 *
 * Rows click through to `/fabrication/jobs/[jobId]` for full scan
 * results + status + teacher review. A prominent "New submission"
 * CTA at the top starts a fresh upload.
 */

import * as React from "react";
import Link from "next/link";
import type { StudentJobRow } from "@/lib/fabrication/orchestration";
import {
  formatRuleCountsCompact,
  formatDateTime,
} from "@/components/fabrication/revision-history-helpers";
import { fabricationStatusPill } from "@/components/fabrication/fabrication-history-helpers";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; jobs: StudentJobRow[] };

export default function StudentFabricationOverviewPage() {
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });

  const fetchJobs = React.useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/student/fabrication/jobs", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setState({
          kind: "error",
          message:
            body.error || `Couldn't load your submissions (HTTP ${res.status})`,
        });
        return;
      }
      const data = (await res.json()) as { jobs: StudentJobRow[] };
      setState({ kind: "ready", jobs: data.jobs ?? [] });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Preflight</h1>
          <p className="text-base text-gray-600 mt-2">
            Your fabrication submissions. Click any row to see scan details,
            teacher notes, or re-upload a revision.
          </p>
        </div>
        <Link
          href="/fabrication/new"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-purple text-white px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          New submission
        </Link>
      </header>

      {state.kind === "loading" && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">
            Loading your submissions…
          </span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">{state.message}</p>
        </div>
      )}

      {state.kind === "ready" && state.jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <p className="text-base text-gray-700">
            You haven&apos;t submitted anything to fabricate yet.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Start by uploading an STL or SVG file for a class fabrication job.
          </p>
          <Link
            href="/fabrication/new"
            className="inline-block mt-4 text-sm font-semibold text-brand-purple underline"
          >
            Start your first submission →
          </Link>
        </div>
      )}

      {state.kind === "ready" && state.jobs.length > 0 && (
        <StudentJobList jobs={state.jobs} />
      )}
    </main>
  );
}

// Phase 6-6o: desktop grid template. Kept as a literal string (not
// a const interpolation) because Tailwind's class-scanner only sees
// classes it can parse at build time — dynamic template literals
// get discarded. Column order:
//   thumbnail · file+status · class · machine · revision · submitted
function StudentJobList({ jobs }: { jobs: StudentJobRow[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Desktop column headers */}
      <div className="hidden md:grid md:grid-cols-[72px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto_auto] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <div aria-hidden="true" />
        <div>File</div>
        <div>Class</div>
        <div>Machine</div>
        <div className="text-center">Revision</div>
        <div className="text-right">Submitted</div>
      </div>
      <ul className="divide-y divide-gray-100">
        {jobs.map((job) => (
          <StudentJobListRow key={job.jobId} job={job} />
        ))}
      </ul>
    </div>
  );
}

function StudentJobListRow({ job }: { job: StudentJobRow }) {
  const counts = formatRuleCountsCompact(job.ruleCounts);
  const submittedAt = formatDateTime(job.createdAt);
  // Phase 7-5d: pill label + colour now branches on completion_status
  // so a `completed+failed` job shows "RUN FAILED" red, not green.
  const { label: statusLabel, pillClass } = fabricationStatusPill(
    job.jobStatus,
    job.completionStatus
  );

  return (
    <li>
      <Link
        href={`/fabrication/jobs/${job.jobId}`}
        className="block hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30"
      >
        {/* Desktop — grid cols must match the header row above exactly. */}
        <div className="hidden md:grid md:grid-cols-[72px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto_auto] gap-4 items-center px-4 py-3">
          <div className="w-14 h-14 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {job.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.thumbnailUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <span aria-hidden="true" className="text-gray-300 text-xs">
                —
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${pillClass}`}
              >
                {statusLabel}
              </span>
              {counts && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                  {counts}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-900 truncate mt-0.5 font-semibold">
              {job.originalFilename}
            </p>
            {job.unitTitle && (
              <p className="text-xs text-gray-500 truncate">{job.unitTitle}</p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-800 truncate">
              {job.className ?? <span className="text-gray-400">—</span>}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-800 truncate">{job.machineLabel}</p>
            {job.machineCategory && (
              <p className="text-xs text-gray-500">
                {job.machineCategory.replace(/_/g, " ")}
              </p>
            )}
          </div>
          <div className="text-xs text-gray-700 font-semibold text-center">
            Rev {job.currentRevision}
          </div>
          <div className="text-xs text-gray-500 text-right whitespace-nowrap">
            {submittedAt}
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden p-3 flex gap-3 items-start">
          <div className="w-12 h-12 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {job.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.thumbnailUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <span aria-hidden="true" className="text-gray-300 text-xs">
                —
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${pillClass}`}
              >
                {statusLabel}
              </span>
              {counts && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                  {counts}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
              {job.originalFilename}
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {job.machineLabel}
              {job.className && ` · ${job.className}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Rev {job.currentRevision} · {submittedAt}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

// Phase 7-5d: previously-local `statusPillClass` was replaced by the
// shared `fabricationStatusPill()` helper in fabrication-history-helpers.ts
// — it branches on `completion_status` too so a `completed+failed` job
// renders "RUN FAILED" red instead of green "COMPLETED" on list views.
