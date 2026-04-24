"use client";

/**
 * /teacher/preflight — Phase 6-3 submissions queue.
 *
 * Replaces the Phase 1B-2 redirect-to-fabricators with the real queue.
 * Fetches `GET /api/teacher/fabrication/queue` (no status filter →
 * everything scoped to the teacher), buckets rows client-side for the
 * 5 status tabs, renders tab bar + table.
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
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TeacherQueueTabs } from "@/components/fabrication/TeacherQueueTabs";
import { TeacherQueueTable } from "@/components/fabrication/TeacherQueueTable";
import {
  bucketRowsForTab,
  countRowsPerTab,
  emptyMessageForTab,
  parseTabParam,
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

  function setTab(next: QueueTab) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", next);
    router.replace(`/teacher/preflight?${params.toString()}`, { scroll: false });
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
          <Link
            href="/teacher/preflight/lab-setup"
            className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.97]"
          >
            Lab setup
          </Link>
          <Link
            href="/teacher/preflight/fabricators"
            className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.97]"
          >
            Fabricators
          </Link>
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
          <TeacherQueueTable
            rows={tabRows}
            emptyMessage={emptyMessageForTab(activeTab)}
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
    </main>
  );
}
