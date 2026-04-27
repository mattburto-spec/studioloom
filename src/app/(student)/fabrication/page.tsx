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
import { canDeleteJob } from "@/components/fabrication/teacher-review-note-helpers";

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

  // Phase 8.1d-32: row-level permanent delete. Refetches on
  // success so the row animates out (well, rerenders without it —
  // no animation here yet, that's a polish target). Track per-job
  // in-flight state so the trash icon shows a spinner during the
  // request without blocking other rows.
  const [deletingJobId, setDeletingJobId] = React.useState<string | null>(
    null
  );
  const handleDelete = React.useCallback(
    async (jobId: string) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "Permanently delete this submission? Your file, scan results, and all revisions will be removed. This can't be undone."
        )
      ) {
        return;
      }
      setDeletingJobId(jobId);
      try {
        const res = await fetch(`/api/student/fabrication/jobs/${jobId}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          // Surface as alert — overview row has no inline error
          // slot, and a 409 here is rare enough that we don't need
          // to invest in inline UI yet.
          if (typeof window !== "undefined") {
            window.alert(
              body.error || `Couldn't delete (HTTP ${res.status})`
            );
          }
          setDeletingJobId(null);
          return;
        }
        await fetchJobs();
      } catch (e) {
        if (typeof window !== "undefined") {
          window.alert(
            e instanceof Error ? e.message : "Network error deleting"
          );
        }
      } finally {
        setDeletingJobId(null);
      }
    },
    [fetchJobs]
  );

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
        <StudentJobList
          jobs={state.jobs}
          onDelete={handleDelete}
          deletingJobId={deletingJobId}
        />
      )}
    </main>
  );
}

// Phase 6-6o: desktop grid template. Kept as a literal string (not
// a const interpolation) because Tailwind's class-scanner only sees
// classes it can parse at build time — dynamic template literals
// get discarded. Column order:
//   thumbnail · file+status · class · machine · revision · submitted
function StudentJobList({
  jobs,
  onDelete,
  deletingJobId,
}: {
  jobs: StudentJobRow[];
  onDelete: (jobId: string) => void;
  deletingJobId: string | null;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Desktop column headers */}
      <div className="hidden md:grid md:grid-cols-[72px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto_auto_auto] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <div aria-hidden="true" />
        <div>File</div>
        <div>Class</div>
        <div>Machine</div>
        <div className="text-center">Revision</div>
        <div className="text-right">Submitted</div>
        <div aria-hidden="true" />
      </div>
      <ul className="divide-y divide-gray-100">
        {jobs.map((job) => (
          <StudentJobListRow
            key={job.jobId}
            job={job}
            onDelete={onDelete}
            isDeleting={deletingJobId === job.jobId}
          />
        ))}
      </ul>
    </div>
  );
}

function StudentJobListRow({
  job,
  onDelete,
  isDeleting,
}: {
  job: StudentJobRow;
  onDelete: (jobId: string) => void;
  isDeleting: boolean;
}) {
  const counts = formatRuleCountsCompact(job.ruleCounts);
  const submittedAt = formatDateTime(job.createdAt);
  // Phase 7-5d: pill label + colour now branches on completion_status
  // so a `completed+failed` job shows "RUN FAILED" red, not green.
  const { label: statusLabel, pillClass } = fabricationStatusPill(
    job.jobStatus,
    job.completionStatus
  );
  // Phase 8.1d-32: row-level delete only when status allows.
  // approved + picked_up jobs hide the trash icon (would 409 anyway).
  const showDelete = canDeleteJob(job.jobStatus);

  return (
    // Phase 8.1d-32: row layout changed from Link-wraps-content to
    // overlay-Link + sibling content. Two reasons:
    //   1. <button> nested inside <a> is invalid HTML — Next/React
    //      tolerate it but right-click + a11y get weird.
    //   2. The trash button needs to live in the normal flow with a
    //      higher z-index than the Link overlay so its click events
    //      win without needing stopPropagation gymnastics.
    // The Link is `absolute inset-0` covering the whole row;
    // hover/focus styles still work via group-hover on the <li>.
    <li className="relative group hover:bg-gray-50 focus-within:bg-gray-50 transition-colors">
      <Link
        href={`/fabrication/jobs/${job.jobId}`}
        aria-label={`Open submission ${job.originalFilename}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 rounded"
      />
      <div className="relative pointer-events-none">
        {/* Desktop — grid cols must match the header row above exactly. */}
        <div className="hidden md:grid md:grid-cols-[72px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto_auto_auto] gap-4 items-center px-4 py-3">
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
          {/* Phase 8.1d-32: row-level delete (desktop). Empty
               div (not button) when status forbids delete so the
               grid columns line up with the header. */}
          <div className="flex justify-end">
            {showDelete ? (
              <DeleteRowButton
                isDeleting={isDeleting}
                onClick={() => onDelete(job.jobId)}
                label={`Delete ${job.originalFilename}`}
              />
            ) : (
              <span aria-hidden="true" className="w-6" />
            )}
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
          {/* Phase 8.1d-32: row-level delete (mobile). */}
          {showDelete && (
            <DeleteRowButton
              isDeleting={isDeleting}
              onClick={() => onDelete(job.jobId)}
              label={`Delete ${job.originalFilename}`}
            />
          )}
        </div>
      </div>
    </li>
  );
}

// Phase 8.1d-32: shared trash button used by both desktop + mobile
// layouts. `pointer-events-auto` re-enables clicks on top of the
// row's pointer-events-none content wrapper (which exists so the
// Link overlay catches everywhere ELSE on the row). e.preventDefault
// + e.stopPropagation belt-and-suspenders even with the
// pointer-events trick — paranoid about edge cases like keyboard
// activation through the focus ring.
function DeleteRowButton({
  isDeleting,
  onClick,
  label,
}: {
  isDeleting: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDeleting) return;
        onClick();
      }}
      disabled={isDeleting}
      aria-label={label}
      title="Delete this submission permanently"
      className="pointer-events-auto relative z-10 p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isDeleting ? (
        <span
          className="block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      )}
    </button>
  );
}

// Phase 7-5d: previously-local `statusPillClass` was replaced by the
// shared `fabricationStatusPill()` helper in fabrication-history-helpers.ts
// — it branches on `completion_status` too so a `completed+failed` job
// renders "RUN FAILED" red instead of green "COMPLETED" on list views.
