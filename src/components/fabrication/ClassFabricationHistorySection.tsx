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
  React.useEffect(() => {
    if (!open) return;
    if (state.kind !== "idle") return;
    let cancelled = false;
    (async () => {
      setState({ kind: "loading" });
      try {
        const res = await fetch(
          `/api/teacher/fabrication/classes/${classId}/history`,
          { credentials: "same-origin" }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          if (!cancelled) {
            setState({
              kind: "error",
              message:
                body.error ||
                `Couldn't load class history (HTTP ${res.status})`,
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
    })();
    return () => {
      cancelled = true;
    };
  }, [open, state.kind, classId]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Fabrication submissions
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pass rate, revisions, and per-student breakdown for this class.
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`text-gray-400 text-xl transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-5">
          {state.kind === "loading" && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Loading…</span>
            </div>
          )}

          {state.kind === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-900">{state.message}</p>
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
