"use client";

/**
 * ClassFabricationHistorySection — Phase 6-4 class-level view.
 *
 * Mounted on `/teacher/classes/[classId]` as a collapsible section
 * (distinct from the student page, which adds it as a Fabrication
 * tab alongside Overview / Discovery). Collapsed by default — it
 * fetches lazily on first expand so the classes page isn't slowed
 * down by a request most teachers don't need on every visit.
 *
 * Renders:
 *   - Summary metric strip (reused from StudentFabricationHistory)
 *   - Per-student drill-down table (unique to class scope)
 *   - Chronological job list (reused, with student column on)
 */

import * as React from "react";
import Link from "next/link";
import {
  HistorySummaryCards,
  HistoryJobList,
} from "./StudentFabricationHistory";
import { formatPassRate } from "./fabrication-history-helpers";
import type {
  HistorySuccess,
  PerStudentHistoryRow,
} from "@/lib/fabrication/teacher-orchestration";

export interface ClassFabricationHistorySectionProps {
  classId: string;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: HistorySuccess };

export function ClassFabricationHistorySection({
  classId,
}: ClassFabricationHistorySectionProps) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<LoadState>({ kind: "idle" });

  // Lazy-fetch: first time the section opens, fire the request. Cache
  // the result so re-collapsing and reopening doesn't re-fetch.
  //
  // Phase 6-6n: added 30s AbortController timeout + console.error on
  // non-2xx so the "loading forever" symptom on a specific class
  // bottoms out to a clear error state instead of a dead spinner.
  // Retries are one-click (collapse → re-expand, or the Retry button
  // in the error card).
  const loadHistory = React.useCallback(async () => {
    setState({ kind: "loading" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(
        `/api/teacher/fabrication/classes/${classId}/history`,
        { credentials: "same-origin", signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        const msg =
          body.error ||
          `Couldn't load class history (HTTP ${res.status} — class ${classId})`;
        // eslint-disable-next-line no-console
        console.error("[ClassFabricationHistory]", msg, { classId });
        setState({ kind: "error", message: msg });
        return;
      }
      const data = (await res.json()) as HistorySuccess;
      setState({ kind: "ready", data });
    } catch (e) {
      clearTimeout(timer);
      const aborted =
        e instanceof DOMException && e.name === "AbortError";
      const msg = aborted
        ? `Class history took too long to load (30s timeout — class ${classId}). Try again.`
        : e instanceof Error
          ? e.message
          : "Network error";
      // eslint-disable-next-line no-console
      console.error("[ClassFabricationHistory]", msg, { classId, error: e });
      setState({ kind: "error", message: msg });
    }
  }, [classId]);

  React.useEffect(() => {
    if (!open) return;
    if (state.kind !== "idle") return;
    void loadHistory();
  }, [open, state.kind, loadHistory]);

  return (
    <section
      className={`rounded-2xl border bg-white overflow-hidden transition-colors ${
        open ? "border-brand-purple/30" : "border-gray-200"
      }`}
    >
      {/* Phase 6-6n: bigger + more obvious expand affordance. Chevron
          icon (not a ›) + explicit "Show" / "Hide" label + purple
          border on expand so the card reads as clearly interactive
          instead of looking like a static heading. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Fabrication submissions
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Pass rate, revisions, and per-student breakdown for this class.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-brand-purple">
            {open ? "Hide" : "Show"}
          </span>
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-brand-purple transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5 space-y-5">
          {state.kind === "loading" && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Loading…</span>
            </div>
          )}

          {state.kind === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start justify-between gap-3 flex-wrap">
              <p className="text-sm text-red-900 flex-1 min-w-0">
                {state.message}
              </p>
              <button
                type="button"
                onClick={() => void loadHistory()}
                className="text-sm font-semibold text-red-900 underline hover:no-underline transition-all active:scale-[0.97]"
              >
                Retry
              </button>
            </div>
          )}

          {state.kind === "ready" && (
            <>
              <HistorySummaryCards summary={state.data.summary} />

              {state.data.jobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-600">
                    No students in this class have submitted fabrication jobs
                    yet.
                  </p>
                </div>
              ) : (
                <>
                  <PerStudentTable rows={state.data.perStudent ?? []} />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      All submissions ({state.data.jobs.length})
                    </h3>
                    <HistoryJobList
                      jobs={state.data.jobs}
                      showStudentColumn
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function PerStudentTable({ rows }: { rows: PerStudentHistoryRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        By student ({rows.length})
      </h3>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="hidden md:grid md:grid-cols-[minmax(0,1.5fr)_auto_auto_auto] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <div>Student</div>
          <div className="text-right">Jobs</div>
          <div className="text-right">Pass rate</div>
          <div className="text-right">Latest</div>
        </div>
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.studentId}>
              <Link
                href={`/teacher/students/${r.studentId}`}
                className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {r.studentName}
                  </p>
                </div>
                <div className="text-sm text-gray-700 text-right">
                  {r.totalJobs}
                </div>
                <div className="text-sm text-right">
                  <span
                    className={
                      r.passRate >= 0.75
                        ? "text-green-700 font-semibold"
                        : r.passRate >= 0.5
                          ? "text-amber-700 font-semibold"
                          : "text-red-700 font-semibold"
                    }
                  >
                    {formatPassRate(r.passRate, r.totalJobs)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({r.passed}/{r.totalJobs})
                  </span>
                </div>
                <div className="text-xs text-gray-500 text-right whitespace-nowrap">
                  {r.latestJobStatus
                    ? r.latestJobStatus.replace(/_/g, " ")
                    : "—"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ClassFabricationHistorySection;
