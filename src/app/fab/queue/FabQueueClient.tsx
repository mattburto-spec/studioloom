"use client";

/**
 * FabQueueClient — interactive queue body for /fab/queue (Phase 7-3).
 *
 * Two tabs:
 *   Ready to pick up   → GET /api/fab/queue?tab=ready
 *   In progress        → GET /api/fab/queue?tab=in_progress
 *
 * Tab state persists via `?tab=` URL param so the back-button from
 * /fab/jobs/[jobId] (Phase 7-4 detail page) returns to the same tab.
 * Each fetch is independent — we don't cache across tab switches
 * (lab-tech use case is look → act → move on, not rapid browsing).
 *
 * Empty-state messages per tab + a distinct "no machines assigned"
 * message (detected by comparing response against ready-tab-empty
 * on a fresh mount — a simpler signal than adding a dedicated flag
 * to the API).
 *
 * Dark slate theme throughout — matches the rest of /fab/*.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FabJobRow } from "@/lib/fabrication/fab-orchestration";
import {
  formatRelativeTime,
  formatDateTime,
} from "@/components/fabrication/revision-history-helpers";
import {
  formatFileSize,
  machineCategoryLabel,
  fabTabLabel,
  fabEmptyMessage,
  type FabQueueTab,
} from "@/components/fabrication/fab-queue-helpers";

// Phase 8.1d-15: client-side filter + sort. Lab techs were
// triaging across multiple classes / machines / days with no way
// to narrow down. Keeping the filter state purely client-side
// means no API changes — the queue endpoint already returns all
// the jobs the fabricator is allowed to see; we just slice + sort
// in the browser.
type SortOrder = "newest" | "oldest";
const _ALL = "__all__"; // sentinel for "no filter"

const TABS: FabQueueTab[] = ["ready", "in_progress"];

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; jobs: FabJobRow[] };

export default function FabQueueClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get("tab") ?? "ready";
  const activeTab: FabQueueTab =
    rawTab === "in_progress" ? "in_progress" : "ready";

  const [state, setState] = React.useState<LoadState>({ kind: "loading" });

  const fetchQueue = React.useCallback(async (tab: FabQueueTab) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/fab/queue?tab=${tab}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setState({
          kind: "error",
          message:
            body.error || `Couldn't load the queue (HTTP ${res.status})`,
        });
        return;
      }
      const data = (await res.json()) as { jobs: FabJobRow[] };
      setState({ kind: "ready", jobs: data.jobs ?? [] });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  React.useEffect(() => {
    void fetchQueue(activeTab);
  }, [activeTab, fetchQueue]);

  function setTab(next: FabQueueTab) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", next);
    router.replace(`/fab/queue?${params.toString()}`, { scroll: false });
  }

  // "No machines assigned yet" is the most likely cause of an empty
  // ready-tab when the fabricator has just been invited. We can't
  // tell from an empty response alone — could be "no jobs right
  // now" or "no machines". Heuristic: if BOTH tabs return empty
  // AND the fabricator has never picked up a job, surface the
  // no-machines message. Simpler approach used here: show the
  // no-assignments hint inline only on the ready tab when empty,
  // alongside the generic "no approved jobs" copy — the lab tech
  // sees both paths in one glance.
  const hasNoAssignments =
    state.kind === "ready" && state.jobs.length === 0 && activeTab === "ready";

  return (
    <div className="mt-6 space-y-5">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Fabricator queue tabs"
        className="flex gap-1 border-b border-slate-800"
      >
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(tab)}
              className={[
                "relative px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-all active:scale-[0.97]",
                isActive
                  ? "border-sky-400 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700",
              ].join(" ")}
            >
              {fabTabLabel(tab)}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {state.kind === "loading" && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading queue…</span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-red-900 bg-red-950/50 p-4">
          <p className="text-sm text-red-200">{state.message}</p>
          <button
            type="button"
            onClick={() => void fetchQueue(activeTab)}
            className="mt-3 text-xs font-semibold text-red-200 underline hover:no-underline transition-all active:scale-[0.97]"
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === "ready" && state.jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
          <p className="text-sm text-slate-300">
            {fabEmptyMessage(activeTab, hasNoAssignments)}
          </p>
        </div>
      )}

      {state.kind === "ready" && state.jobs.length > 0 && (
        <FabJobList jobs={state.jobs} />
      )}
    </div>
  );
}

function FabJobList({ jobs }: { jobs: FabJobRow[] }) {
  // Filter + sort state — local to the list since we want it to
  // reset when the tab changes (different jobs anyway).
  const [classFilter, setClassFilter] = React.useState<string>(_ALL);
  const [machineFilter, setMachineFilter] = React.useState<string>(_ALL);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("newest");

  // Derive available filter values from the jobs we actually have.
  // No need to fetch the full class/machine lists; the dropdown
  // only shows values that match at least one row.
  const { classOptions, machineOptions } = React.useMemo(() => {
    const classes = new Set<string>();
    const machines = new Set<string>();
    for (const j of jobs) {
      if (j.className) classes.add(j.className);
      if (j.machineLabel) machines.add(j.machineLabel);
    }
    return {
      classOptions: Array.from(classes).sort((a, b) => a.localeCompare(b)),
      machineOptions: Array.from(machines).sort((a, b) => a.localeCompare(b)),
    };
  }, [jobs]);

  // Sort key: prefer pickedUpAt (in_progress tab) else approvedAt.
  // Both are ISO strings → string-compare works for sorting.
  function sortKey(job: FabJobRow): string {
    return job.pickedUpAt ?? job.approvedAt ?? "";
  }

  const visibleJobs = React.useMemo(() => {
    const filtered = jobs.filter((j) => {
      if (classFilter !== _ALL && j.className !== classFilter) return false;
      if (machineFilter !== _ALL && j.machineLabel !== machineFilter)
        return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (ka === kb) return 0;
      const cmp = ka < kb ? -1 : 1;
      return sortOrder === "newest" ? -cmp : cmp;
    });
  }, [jobs, classFilter, machineFilter, sortOrder]);

  const isFiltered = classFilter !== _ALL || machineFilter !== _ALL;
  const showFilterBar =
    jobs.length > 1 && (classOptions.length > 1 || machineOptions.length > 1);

  return (
    <div>
      {showFilterBar && (
        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {classOptions.length > 1 && (
              <FilterSelect
                label="Class"
                value={classFilter}
                onChange={setClassFilter}
                options={classOptions}
              />
            )}
            {machineOptions.length > 1 && (
              <FilterSelect
                label="Machine"
                value={machineFilter}
                onChange={setMachineFilter}
                options={machineOptions}
              />
            )}
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-slate-400">Sort</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="rounded border border-slate-700 bg-slate-950 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {isFiltered ? (
              <>
                Showing {visibleJobs.length} of {jobs.length} jobs.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setClassFilter(_ALL);
                    setMachineFilter(_ALL);
                  }}
                  className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                {jobs.length} {jobs.length === 1 ? "job" : "jobs"} total
              </>
            )}
          </p>
        </div>
      )}

      {visibleJobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
          <p className="text-sm text-slate-300">
            No jobs match your filters.{" "}
            <button
              type="button"
              onClick={() => {
                setClassFilter(_ALL);
                setMachineFilter(_ALL);
              }}
              className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
            >
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleJobs.map((job) => (
            <FabJobListRow key={job.jobId} job={job} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-700 bg-slate-950 text-slate-200 text-xs px-2 py-1 max-w-[12rem] truncate focus:outline-none focus:ring-2 focus:ring-sky-500/40"
      >
        <option value={_ALL}>All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function FabJobListRow({ job }: { job: FabJobRow }) {
  // Phase 8.1d-17: surface BOTH submitted + approved timestamps so
  // the lab tech sees the full lifecycle:
  //   "Submitted 4h ago · 26 Apr · 09:15
  //    Approved  2h ago · 26 Apr · 11:30
  //    Picked up 1h ago · 26 Apr · 12:45"  (only when applicable)
  // Each line independently absent if the data isn't there yet.
  const submittedRel = `Submitted ${formatRelativeTime(job.createdAt)}`;
  const submittedAbs = formatDateTime(job.createdAt);
  const approvedRel = job.approvedAt
    ? `Approved ${formatRelativeTime(job.approvedAt)}`
    : null;
  const approvedAbs = job.approvedAt ? formatDateTime(job.approvedAt) : null;
  const pickedUpRel = job.pickedUpAt
    ? `Picked up ${formatRelativeTime(job.pickedUpAt)}`
    : null;
  const pickedUpAbs = job.pickedUpAt ? formatDateTime(job.pickedUpAt) : null;

  // File-type chip — distinct colour per format so a busy queue
  // can be triaged at a glance ("which of these are 3D vs laser?").
  // Tied to fileType (not machineCategory) so we surface the actual
  // student-uploaded format, even if the machine category info is
  // missing on a malformed row.
  const fileTypeUpper = job.fileType.toUpperCase();
  const fileTypeChipClass =
    job.fileType === "stl"
      ? "bg-orange-950/40 text-orange-300 border border-orange-900"
      : "bg-teal-950/40 text-teal-300 border border-teal-900";

  return (
    <li>
      <Link
        href={`/fab/jobs/${job.jobId}`}
        className="block rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 p-4 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
      >
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
            {job.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.thumbnailUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <span aria-hidden="true" className="text-slate-700 text-xs">
                —
              </span>
            )}
          </div>

          {/* Primary info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-semibold text-slate-100 truncate">
                {job.studentName}
              </span>
              {job.className && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-semibold">
                  {job.className}
                </span>
              )}
              {job.unitTitle && (
                <span className="text-xs text-slate-500 truncate">
                  · {job.unitTitle}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              {/* Phase 8.1d-17: file-type chip — orange for STL,
                   teal for SVG. Quick "which kind of job is this?"
                   read for a busy lab tech. */}
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded font-mono shrink-0 ${fileTypeChipClass}`}
                title={`File format: .${job.fileType}`}
              >
                {fileTypeUpper}
              </span>
              <p className="text-xs text-slate-400 font-mono truncate">
                {job.originalFilename}
              </p>
            </div>
            <div className="text-xs text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>
                {job.machineLabel}{" "}
                <span className="text-slate-600">
                  ({machineCategoryLabel(job.machineCategory)})
                </span>
              </span>
              <span aria-hidden="true" className="text-slate-700">
                ·
              </span>
              <span>Rev {job.currentRevision}</span>
              <span aria-hidden="true" className="text-slate-700">
                ·
              </span>
              <span>{formatFileSize(job.fileSizeBytes)}</span>
            </div>
            {job.teacherReviewNote && (
              <p className="text-xs text-sky-200/80 mt-2 italic line-clamp-1">
                Teacher note: {job.teacherReviewNote}
              </p>
            )}
          </div>

          {/* Right-side timeline — Phase 8.1d-17: full lifecycle.
              Submitted (always), Approved (when teacher's actioned),
              Picked up (when this fab has it). Each row stacks the
              relative time over the absolute date so a lab tech can
              triage quickly AND resolve precise timing when needed
              (e.g. "approved yesterday at 14:32"). */}
          <div className="text-xs whitespace-nowrap shrink-0 text-right space-y-1.5">
            <TimelineRow
              label={submittedRel}
              absolute={submittedAbs}
              tone="slate"
            />
            {approvedRel && (
              <TimelineRow
                label={approvedRel}
                absolute={approvedAbs}
                tone="sky"
              />
            )}
            {pickedUpRel && (
              <TimelineRow
                label={pickedUpRel}
                absolute={pickedUpAbs}
                tone="emerald"
              />
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

/**
 * Phase 8.1d-17: one timeline-step block for FabJobListRow.
 * Renders a labelled relative time on top and the absolute
 * date+time stamp on the line below in monospace.
 */
function TimelineRow({
  label,
  absolute,
  tone,
}: {
  label: string;
  absolute: string | null;
  tone: "slate" | "sky" | "emerald";
}) {
  // Tone tints just the label so the eye picks out submitted-vs-
  // approved-vs-picked-up at a glance. Absolute stays muted gray
  // for hierarchy.
  const labelClass =
    tone === "sky"
      ? "text-sky-300"
      : tone === "emerald"
        ? "text-emerald-300"
        : "text-slate-400";
  return (
    <div>
      <div className={labelClass}>{label}</div>
      {absolute && (
        <div className="text-slate-600 font-mono mt-0.5 text-[11px]">
          {absolute}
        </div>
      )}
    </div>
  );
}
