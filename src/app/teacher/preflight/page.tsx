"use client";

/**
 * /teacher/preflight — Phase 6-3 submissions queue + 8.1d-16
 *                      filter / sort / bulk-approve.
 *
 * Replaces the Phase 1B-2 redirect-to-fabricators with the real queue.
 * Fetches `GET /api/teacher/fabrication/queue` (no status filter →
 * everything scoped to the teacher), buckets rows client-side for the
 * 5 status tabs, renders tab bar + filter bar + bulk-action bar +
 * table.
 *
 * Why client-side bucketing vs N requests (one per tab):
 *   - Queue endpoint is already capped at 200 rows; tab counts are
 *     accurate for realistic teacher loads.
 *   - One request keeps tab switching snappy (no spinner jump).
 *   - When a teacher has >200 active submissions (unlikely but
 *     possible), file `PH6-FU-QUEUE-LARGE` to split to per-tab
 *     fetches + server-side counts. Out of Phase 6 scope.
 *
 * Active tab persists via `?tab=` so the back button from the detail
 * page (Phase 6-2) returns the teacher to the same filtered view.
 *
 * Phase 8.1d-16 additions (Matt's S3 smoke):
 *   - Class / machine dropdowns + free-text search + sort order
 *   - Absolute timestamps on each row (not just relative)
 *   - Bulk approve via row checkboxes + "Approve N selected" bar
 *   - "Approve all clean" smart-button on the pending tab
 *   - Confirmation dialog before any batch action
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TeacherQueueTabs } from "@/components/fabrication/TeacherQueueTabs";
import { TeacherQueueTable } from "@/components/fabrication/TeacherQueueTable";
import { PreflightTeacherNav } from "@/components/fabrication/PreflightTeacherNav";
import {
  bucketRowsForTab,
  countRowsPerTab,
  emptyMessageForTab,
  isCleanRow,
  matchesSearch,
  parseTabParam,
  sortKeyForRow,
  type QueueTab,
} from "@/components/fabrication/teacher-queue-helpers";
import type { QueueRow } from "@/lib/fabrication/teacher-orchestration";

interface QueueFetchState {
  loading: boolean;
  error: string | null;
  rows: QueueRow[];
  total: number;
}

const QUEUE_CAP = 200;
const _ALL = "__all__"; // sentinel for "no class/machine filter"

type SortOrder = "newest" | "oldest";

export default function TeacherPreflightPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: QueueTab = parseTabParam(searchParams?.get("tab") ?? null);

  const [state, setState] = React.useState<QueueFetchState>({
    loading: true,
    error: null,
    rows: [],
    total: 0,
  });

  // Filter / sort state — local to the page; resets to defaults
  // on tab change so a stale "class=ENG10" filter from the
  // pending tab doesn't carry into the completed tab.
  const [classFilter, setClassFilter] = React.useState<string>(_ALL);
  const [machineFilter, setMachineFilter] = React.useState<string>(_ALL);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("newest");

  // Bulk-action state — only meaningful on the pending tab.
  const [selectedJobIds, setSelectedJobIds] = React.useState<Set<string>>(
    new Set()
  );
  const [batchInFlight, setBatchInFlight] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState<{
    done: number;
    total: number;
    errors: string[];
  } | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<
    | { kind: "approve_selected"; ids: string[] }
    | { kind: "approve_clean"; ids: string[] }
    | null
  >(null);

  const fetchQueue = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // No status filter → get everything, bucket client-side.
      const res = await fetch(
        `/api/teacher/fabrication/queue?limit=${QUEUE_CAP}`,
        { credentials: "same-origin" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setState({
          loading: false,
          error:
            body.error || `Couldn't load the queue (HTTP ${res.status})`,
          rows: [],
          total: 0,
        });
        return;
      }
      const data = (await res.json()) as { total: number; rows: QueueRow[] };
      setState({
        loading: false,
        error: null,
        rows: data.rows ?? [],
        total: data.total ?? 0,
      });
    } catch (e) {
      setState({
        loading: false,
        error: e instanceof Error ? e.message : "Network error",
        rows: [],
        total: 0,
      });
    }
  }, []);

  React.useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const counts = React.useMemo(
    () => countRowsPerTab(state.rows),
    [state.rows]
  );
  const tabRows = React.useMemo(
    () => bucketRowsForTab(state.rows, activeTab),
    [state.rows, activeTab]
  );

  // Derive available class / machine options from tab rows so
  // dropdowns only offer values that actually appear under the
  // currently-viewed bucket.
  const { classOptions, machineOptions } = React.useMemo(() => {
    const classes = new Set<string>();
    const machines = new Set<string>();
    for (const r of tabRows) {
      if (r.className) classes.add(r.className);
      if (r.machineLabel) machines.add(r.machineLabel);
    }
    return {
      classOptions: Array.from(classes).sort((a, b) => a.localeCompare(b)),
      machineOptions: Array.from(machines).sort((a, b) => a.localeCompare(b)),
    };
  }, [tabRows]);

  // Apply filter + sort to tab rows. Memoised so re-renders from
  // selection toggles don't recompute the filter pipeline.
  const visibleRows = React.useMemo(() => {
    const filtered = tabRows.filter((r) => {
      if (classFilter !== _ALL && r.className !== classFilter) return false;
      if (machineFilter !== _ALL && r.machineLabel !== machineFilter) return false;
      if (!matchesSearch(r, searchQuery)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const ka = sortKeyForRow(a, activeTab);
      const kb = sortKeyForRow(b, activeTab);
      if (ka === kb) return 0;
      const cmp = ka < kb ? -1 : 1;
      return sortOrder === "newest" ? -cmp : cmp;
    });
  }, [tabRows, classFilter, machineFilter, searchQuery, sortOrder, activeTab]);

  // Selectable = pending_approval rows in the current view. Other
  // rows can't be batch-actioned.
  const selectableIds = React.useMemo(() => {
    return new Set(
      visibleRows
        .filter((r) => r.jobStatus === "pending_approval")
        .map((r) => r.jobId)
    );
  }, [visibleRows]);

  // Clean-and-pending count for the smart button — across the
  // ENTIRE pending tab, not just the filtered view, so the button
  // is always honest about how many one-click approvals are
  // available.
  const cleanPendingIds = React.useMemo(() => {
    return tabRows
      .filter((r) => r.jobStatus === "pending_approval" && isCleanRow(r))
      .map((r) => r.jobId);
  }, [tabRows]);

  function setTab(next: QueueTab) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", next);
    router.replace(`/teacher/preflight?${params.toString()}`, { scroll: false });
    // Reset within-tab state on tab change.
    setClassFilter(_ALL);
    setMachineFilter(_ALL);
    setSearchQuery("");
    setSelectedJobIds(new Set());
  }

  function toggleSelect(jobId: string) {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedJobIds((prev) => {
      // If everything selectable is already selected, clear.
      // Otherwise, select all selectable.
      const allSelected = Array.from(selectableIds).every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of selectableIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of selectableIds) next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setClassFilter(_ALL);
    setMachineFilter(_ALL);
    setSearchQuery("");
  }

  // Batch approve. Client-side loop over the per-job /approve
  // endpoint — keeps the API surface small and per-row error
  // handling honest. For 5–10 jobs the latency cost is fine; if
  // we ever need 50+ in one batch, file PH9-FU-TEACHER-BULK-API.
  async function runBatchApprove(ids: string[]) {
    setBatchInFlight(true);
    setBatchProgress({ done: 0, total: ids.length, errors: [] });
    const errors: string[] = [];
    let done = 0;
    for (const jobId of ids) {
      try {
        const res = await fetch(
          `/api/teacher/fabrication/jobs/${jobId}/approve`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          errors.push(
            `${jobId.slice(0, 8)}: ${body.error || `HTTP ${res.status}`}`
          );
        }
      } catch (e) {
        errors.push(
          `${jobId.slice(0, 8)}: ${e instanceof Error ? e.message : "network"}`
        );
      }
      done += 1;
      setBatchProgress({ done, total: ids.length, errors: [...errors] });
    }
    setBatchInFlight(false);
    setConfirmAction(null);
    setSelectedJobIds(new Set());
    // Re-fetch so the table reflects the new statuses.
    await fetchQueue();
    // Hold the progress banner for ~3s on success, longer on errors,
    // so the teacher can read the outcome before it disappears.
    setTimeout(() => setBatchProgress(null), errors.length > 0 ? 8000 : 3000);
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <PreflightTeacherNav />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Preflight submissions
          </h1>
          <p className="text-base text-gray-600 mt-2">
            Review student fabrication jobs, approve or return for revision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchQueue}
            disabled={state.loading}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white transition-all hover:bg-gray-50 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            {state.loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tabs — always rendered so layout is stable during loading */}
      <TeacherQueueTabs
        activeTab={activeTab}
        counts={counts}
        onChange={setTab}
      />

      {/* Content */}
      {state.loading && state.rows.length === 0 && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Loading queue…</span>
        </div>
      )}

      {state.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">{state.error}</p>
        </div>
      )}

      {!state.loading && !state.error && (
        <>
          {/* Phase 8.1d-16: filter bar. Only renders when there's
               something useful to filter on (>1 class OR >1 machine,
               or any rows at all for the search box). */}
          {tabRows.length > 1 && (
            <div className="mt-4 mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
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
                <input
                  type="search"
                  placeholder="Search student / file / unit…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[10rem] max-w-[20rem] rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                />
                <div className="ml-auto flex items-center gap-2">
                  <label className="text-xs text-gray-500">Sort</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="rounded border border-gray-300 bg-white text-xs px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                  >
                    <option value="newest">
                      {activeTab === "pending"
                        ? "Newest waits first"
                        : "Newest activity first"}
                    </option>
                    <option value="oldest">
                      {activeTab === "pending"
                        ? "Longest waiting first"
                        : "Oldest activity first"}
                    </option>
                  </select>
                </div>
              </div>
              {(classFilter !== _ALL ||
                machineFilter !== _ALL ||
                searchQuery.trim() !== "") && (
                <p className="mt-2 text-xs text-gray-500">
                  Showing {visibleRows.length} of {tabRows.length}.{" "}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-brand-purple hover:underline"
                  >
                    Clear filters
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Phase 8.1d-16: smart-button on the pending tab — one
               click approves every clean (no rules firing) job
               currently pending. Always considers the FULL pending
               tab, not the filtered view, so a class filter doesn't
               accidentally hide jobs the teacher could approve. */}
          {activeTab === "pending" && cleanPendingIds.length > 0 && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-emerald-900">
                <span className="font-semibold">
                  {cleanPendingIds.length}{" "}
                  {cleanPendingIds.length === 1
                    ? "submission has"
                    : "submissions have"}
                </span>{" "}
                no scanner findings — safe to approve in one click.
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfirmAction({
                    kind: "approve_clean",
                    ids: cleanPendingIds,
                  })
                }
                disabled={batchInFlight}
                className="text-sm font-semibold px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-[0.97] disabled:opacity-50"
              >
                Approve {cleanPendingIds.length} clean{" "}
                {cleanPendingIds.length === 1 ? "submission" : "submissions"}
              </button>
            </div>
          )}

          {/* Phase 8.1d-16: selection action bar — sticky under the
               smart-button when ≥1 row is checked. */}
          {activeTab === "pending" && selectedJobIds.size > 0 && (
            <div className="mb-3 rounded-xl border border-brand-purple/40 bg-brand-purple/5 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-gray-900">
                <span className="font-semibold">{selectedJobIds.size}</span>{" "}
                selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedJobIds(new Set())}
                  className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-all active:scale-[0.97]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmAction({
                      kind: "approve_selected",
                      ids: Array.from(selectedJobIds),
                    })
                  }
                  disabled={batchInFlight}
                  className="text-sm font-semibold px-3 py-1.5 rounded bg-brand-purple text-white hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50"
                >
                  Approve {selectedJobIds.size}
                </button>
              </div>
            </div>
          )}

          {/* Phase 8.1d-16: batch progress banner */}
          {batchProgress && (
            <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
              <p className="text-blue-900">
                {batchInFlight
                  ? `Approving ${batchProgress.done} of ${batchProgress.total}…`
                  : batchProgress.errors.length === 0
                    ? `✓ Approved ${batchProgress.total} submission${batchProgress.total === 1 ? "" : "s"}.`
                    : `Approved ${batchProgress.done - batchProgress.errors.length} of ${batchProgress.total} (${batchProgress.errors.length} failed).`}
              </p>
              {batchProgress.errors.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-xs text-red-800 space-y-0.5">
                  {batchProgress.errors.slice(0, 5).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                  {batchProgress.errors.length > 5 && (
                    <li>… and {batchProgress.errors.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <TeacherQueueTable
            rows={visibleRows}
            emptyMessage={emptyMessageForTab(activeTab)}
            // Selection only enabled on the pending tab — the only
            // tab where rows are actionable as a batch.
            selection={
              activeTab === "pending"
                ? {
                    selectedIds: selectedJobIds,
                    onToggle: toggleSelect,
                    onToggleAll: toggleSelectAll,
                    selectableIds,
                  }
                : undefined
            }
          />
          {state.total > QUEUE_CAP && (
            <p className="text-xs text-gray-500">
              Showing the {QUEUE_CAP} most recent submissions (of{" "}
              {state.total} total). Filter by tab to narrow — full pagination
              ships later.
            </p>
          )}
        </>
      )}

      {/* Phase 8.1d-16: confirmation dialog. Plain modal — uses
           native window.confirm would skip out the keyboard
           navigation, so we render an inline modal here. */}
      {confirmAction && (
        <ConfirmBatchModal
          action={confirmAction}
          rows={state.rows}
          inFlight={batchInFlight}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => runBatchApprove(confirmAction.ids)}
        />
      )}
    </main>
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
      <label className="text-xs text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 bg-white text-xs px-2 py-1 max-w-[12rem] truncate focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
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

function ConfirmBatchModal({
  action,
  rows,
  inFlight,
  onCancel,
  onConfirm,
}: {
  action: { kind: "approve_selected" | "approve_clean"; ids: string[] };
  rows: QueueRow[];
  inFlight: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const idSet = new Set(action.ids);
  const matching = rows.filter((r) => idSet.has(r.jobId));
  // Show first 6 student names — keeps the modal scannable. Long
  // batches just say "and N more".
  const preview = matching.slice(0, 6);
  const remainder = matching.length - preview.length;
  const verb =
    action.kind === "approve_clean"
      ? `Approve all ${action.ids.length} clean submissions?`
      : `Approve ${action.ids.length} selected submissions?`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{verb}</h2>
        <p className="text-sm text-gray-600">
          Each submission moves from <strong>Pending approval</strong> to{" "}
          <strong>Approved</strong>. The fabricator will see them in their
          queue.{" "}
          {action.kind === "approve_clean" && (
            <span className="text-emerald-700">
              All have zero scanner findings.
            </span>
          )}
        </p>
        <ul className="text-sm text-gray-700 space-y-0.5 max-h-40 overflow-y-auto">
          {preview.map((r) => (
            <li key={r.jobId} className="truncate">
              · {r.studentName}
              {r.className && (
                <span className="text-gray-400"> · {r.className}</span>
              )}
            </li>
          ))}
          {remainder > 0 && (
            <li className="text-gray-400 italic">… and {remainder} more</li>
          )}
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={inFlight}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={inFlight}
            className="text-sm font-semibold px-3 py-1.5 rounded bg-brand-purple text-white hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            {inFlight ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
