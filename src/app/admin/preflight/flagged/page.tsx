"use client";

/**
 * /admin/preflight/flagged — Pilot Mode P3 dev review surface.
 *
 * Read-only triage view for Matt-as-developer. Lists every job
 * across all schools that the scanner flagged (block/warn) or that
 * a student bypassed via Pilot Mode override. Each row links to a
 * signed download of the original file so we can reproduce the
 * scanner finding locally and decide whether the rule needs tuning.
 *
 * Auth: gated server-side by the API route (`requirePlatformAdmin`).
 * The page itself doesn't enforce — if a non-admin reaches the URL,
 * the fetch returns 403 and the page shows the error card.
 */

import * as React from "react";
import type { FlaggedJobRow } from "@/app/api/admin/preflight/flagged/route";

interface FetchState {
  loading: boolean;
  error: string | null;
  rows: FlaggedJobRow[];
  total: number;
}

export default function AdminPreflightFlaggedPage() {
  const [state, setState] = React.useState<FetchState>({
    loading: true,
    error: null,
    rows: [],
    total: 0,
  });
  const [filter, setFilter] = React.useState<
    "all" | "block-only" | "override-only"
  >("all");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch("/api/admin/preflight/flagged", {
          credentials: "same-origin",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          if (!cancelled) {
            setState({
              loading: false,
              error: body.error || `HTTP ${res.status}`,
              rows: [],
              total: 0,
            });
          }
          return;
        }
        const data = (await res.json()) as { rows: FlaggedJobRow[]; total: number };
        if (!cancelled) {
          setState({ loading: false, error: null, rows: data.rows, total: data.total });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            loading: false,
            error: e instanceof Error ? e.message : "Network error",
            rows: [],
            total: 0,
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = React.useMemo(() => {
    if (filter === "all") return state.rows;
    if (filter === "block-only") {
      return state.rows.filter((r) => r.ruleCounts.block > 0);
    }
    return state.rows.filter((r) => r.pilotOverrideAt !== null);
  }, [state.rows, filter]);

  // Aggregate rule-id histogram for the top-of-page tuning summary.
  const ruleHistogram = React.useMemo(() => {
    const counts = new Map<string, { fired: number; overridden: number }>();
    for (const row of state.rows) {
      for (const id of row.ruleIds) {
        const existing = counts.get(id) ?? { fired: 0, overridden: 0 };
        existing.fired += 1;
        counts.set(id, existing);
      }
      for (const id of row.pilotOverrideRuleIds) {
        const existing = counts.get(id) ?? { fired: 0, overridden: 0 };
        existing.overridden += 1;
        counts.set(id, existing);
      }
    }
    return Array.from(counts.entries())
      .map(([id, { fired, overridden }]) => ({ id, fired, overridden }))
      .sort((a, b) => b.fired + b.overridden - (a.fired + a.overridden));
  }, [state.rows]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Preflight — Flagged jobs</h1>
        <p className="text-sm text-gray-600">
          Cross-school triage. Lists every fabrication job whose latest scan fired
          a BLOCK or WARN rule, plus any job a student pushed through with the
          Pilot Mode override. Read-only — use this to find false positives
          and tune the ruleset.
        </p>
      </header>

      {state.loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading flagged jobs…
        </div>
      )}

      {state.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {state.error}
        </div>
      )}

      {!state.loading && !state.error && (
        <>
          {/* Rule-firing histogram — quick "which rules are triggering / getting overridden most" view. */}
          {ruleHistogram.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Rule activity (current view: {state.total} flagged jobs)
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ruleHistogram.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200"
                  >
                    <span className="font-mono text-xs text-gray-800">{row.id}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-gray-700">
                        fired <strong>{row.fired}</strong>
                      </span>
                      {row.overridden > 0 && (
                        <span className="text-amber-800">
                          overridden <strong>{row.overridden}</strong>
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Filter chips */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-600">Filter:</span>
            {(["all", "block-only", "override-only"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "px-3 py-1 rounded-full bg-brand-purple text-white font-semibold"
                    : "px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              >
                {f === "all"
                  ? `All (${state.rows.length})`
                  : f === "block-only"
                    ? `BLOCK only (${state.rows.filter((r) => r.ruleCounts.block > 0).length})`
                    : `Overrides only (${state.rows.filter((r) => r.pilotOverrideAt).length})`}
              </button>
            ))}
          </div>

          {/* Table */}
          {visibleRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600">
              No flagged jobs match this filter.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {visibleRows.map((row) => (
                  <li key={row.jobId} className="p-4 flex flex-col md:flex-row gap-4">
                    <div className="w-20 h-20 shrink-0 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                      {row.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span aria-hidden="true" className="text-gray-300">—</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-gray-900">{row.studentName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 uppercase tracking-wide font-bold">
                          {row.jobStatus.replace(/_/g, " ")}
                        </span>
                        {row.pilotOverrideAt && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                            ⚠ Override × {row.pilotOverrideRuleIds.length}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                        <span className="font-mono">{row.originalFilename}</span>
                        <span>·</span>
                        <span>Rev {row.currentRevision}</span>
                        <span>·</span>
                        <span>{row.machineLabel}</span>
                        {row.className && (
                          <>
                            <span>·</span>
                            <span>{row.className}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="font-mono text-gray-400">
                          {new Date(row.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {row.ruleIds.map((id) => {
                          const isOverridden = row.pilotOverrideRuleIds.includes(id);
                          return (
                            <span
                              key={id}
                              className={
                                isOverridden
                                  ? "text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200"
                                  : "text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200"
                              }
                            >
                              {id}
                            </span>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-1">
                        teacher: {row.teacherId.slice(0, 8)}… · school:{" "}
                        {row.schoolId ? row.schoolId.slice(0, 8) + "…" : "—"} · job:{" "}
                        {row.jobId.slice(0, 8)}…
                      </div>
                    </div>
                    <div className="shrink-0 flex md:flex-col items-start md:items-end gap-2">
                      {row.downloadUrl ? (
                        <a
                          href={row.downloadUrl}
                          download={row.originalFilename}
                          className="text-xs px-3 py-1.5 rounded-lg bg-brand-purple text-white font-semibold hover:opacity-90"
                        >
                          Download original
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 italic">no file</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  );
}
