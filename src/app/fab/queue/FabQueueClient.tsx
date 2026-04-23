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
import { formatRelativeTime } from "@/components/fabrication/revision-history-helpers";
import {
  formatFileSize,
  machineCategoryLabel,
  fabTabLabel,
  fabEmptyMessage,
  type FabQueueTab,
} from "@/components/fabrication/fab-queue-helpers";

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
  return (
    <ul className="space-y-3">
      {jobs.map((job) => (
        <FabJobListRow key={job.jobId} job={job} />
      ))}
    </ul>
  );
}

function FabJobListRow({ job }: { job: FabJobRow }) {
  const when = job.pickedUpAt
    ? `Picked up ${formatRelativeTime(job.pickedUpAt)}`
    : job.approvedAt
      ? `Approved ${formatRelativeTime(job.approvedAt)}`
      : "—";

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
            <p className="text-xs text-slate-400 font-mono truncate mt-1">
              {job.originalFilename}
            </p>
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

          {/* Right-side time */}
          <div className="text-xs text-slate-500 whitespace-nowrap shrink-0 mt-0.5">
            {when}
          </div>
        </div>
      </Link>
    </li>
  );
}
