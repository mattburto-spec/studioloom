"use client";

/**
 * AG.4.2 — Teacher Attention-Rotation Panel.
 *
 * Renders per-student attention signals so a teacher can plan their 1:1
 * rotation in seconds. "Suggested 1:1 today" badge surfaces the bottom-
 * third by Three Cs aggregate (per Cowork research — that's the rotation
 * target, not the overall sort order).
 *
 * Backed by GET /api/teacher/student-attention. Pure aggregation +
 * scoring lives in @/lib/unit-tools/attention/aggregate.ts; this
 * component is render-only.
 */

import { useEffect, useState } from "react";
import {
  loadAttentionPanel,
  AttentionApiError,
} from "@/lib/unit-tools/attention/client";
import type { AttentionPanelData, AttentionRow } from "@/lib/unit-tools/attention/types";
import { formatRelative, isStale } from "./unit-attention-helpers";

interface UnitAttentionPanelProps {
  unitId: string;
  classId: string;
}

type LoadStatus = "idle" | "loading" | "ready" | "error";

export default function UnitAttentionPanel({
  unitId,
  classId,
}: UnitAttentionPanelProps) {
  const [data, setData] = useState<AttentionPanelData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    loadAttentionPanel(unitId, classId)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof AttentionApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to load attention panel";
        setError(msg);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [unitId, classId]);

  if (status === "loading" || status === "idle") {
    return (
      <div
        className="text-[12px] text-gray-500 italic p-4"
        data-testid="attention-loading"
      >
        Loading attention panel...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-3"
        data-testid="attention-error"
      >
        Couldn&apos;t load attention panel: {error ?? "unknown error"}.{" "}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="underline underline-offset-2"
        >
          Reload
        </button>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div
        className="text-[12px] text-gray-400 italic p-4 bg-gray-50 rounded border border-dashed border-gray-300 text-center"
        data-testid="attention-empty"
      >
        No students enrolled in this class yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="attention-panel">
      <DontRescueBanner />
      <div className="text-[10.5px] uppercase tracking-wide text-gray-500 px-1 flex items-center gap-2">
        <span className="font-semibold">Attention rotation</span>
        <span className="text-gray-300">·</span>
        <span>{data.rows.length} students</span>
        <span className="text-gray-300">·</span>
        <span>
          {data.rows.filter((r) => r.suggestedOneOnOne).length} suggested 1:1
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.rows.map((row) => (
          <AttentionRowItem key={row.studentId} row={row} nowIso={data.nowIso} />
        ))}
      </ul>
    </div>
  );
}

// ─── Don't Rescue banner (AG.4.3) ──────────────────────────────────────────

/**
 * Persistent banner reminding the teacher not to rescue students out of
 * struggle — recovery IS the learning. Per Cowork's "most insidious pitfall"
 * warning. Daily reconditioning, rendered above the panel rows so the
 * teacher sees it every time they consult the rotation.
 *
 * Exported separately so it can also be mounted at the top of the Class
 * Hub regardless of which tab is active (caller's choice).
 */
export function DontRescueBanner() {
  return (
    <div
      className="bg-amber-50 border border-amber-300 rounded p-2.5 text-[11.5px] text-amber-900 flex items-start gap-2"
      data-testid="dont-rescue-banner"
    >
      <span className="text-base leading-none" aria-hidden="true">
        🛑
      </span>
      <div className="flex-1">
        <div className="font-semibold">Don&apos;t rescue.</div>
        <div className="text-amber-800">
          Recovery IS the learning. Step in only for safety or dangerous
          mistakes.
        </div>
      </div>
    </div>
  );
}

// ─── Per-row renderer ──────────────────────────────────────────────────────

interface AttentionRowItemProps {
  row: AttentionRow;
  nowIso: string;
}

function AttentionRowItem({ row, nowIso }: AttentionRowItemProps) {
  const aggregate = row.threeCs.aggregate;

  return (
    <li
      className={
        "flex items-center gap-3 px-3 py-2 rounded border " +
        (row.suggestedOneOnOne
          ? "bg-violet-50 border-violet-300"
          : "bg-white border-gray-200 hover:border-gray-300")
      }
      data-testid={`attention-row-${row.studentId}`}
      data-suggested-one-on-one={row.suggestedOneOnOne}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-[12.5px] truncate">
            {row.displayName}
          </span>
          {row.suggestedOneOnOne && (
            <span
              className="text-[9.5px] uppercase tracking-wide bg-violet-600 text-white px-1.5 py-0.5 rounded"
              data-testid="attention-1on1-badge"
            >
              Suggested 1:1
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-gray-500 mt-0.5">
          <SignalCell
            label="Journal"
            iso={row.lastJournalAt}
            nowIso={nowIso}
            testId="attention-signal-journal"
          />
          <SignalCell
            label="Kanban"
            iso={row.lastKanbanMoveAt}
            nowIso={nowIso}
            testId="attention-signal-kanban"
          />
          <SignalCell
            label="Calibration"
            iso={row.lastCalibrationAt}
            nowIso={nowIso}
            testId="attention-signal-calibration"
          />
        </div>
      </div>
      <ThreeCsBadge aggregate={aggregate} />
    </li>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface SignalCellProps {
  label: string;
  iso: string | null;
  nowIso: string;
  testId: string;
}

function SignalCell({ label, iso, nowIso, testId }: SignalCellProps) {
  const formatted = formatRelative(iso, nowIso);
  return (
    <span className="flex items-center gap-1" data-testid={testId}>
      <span className="text-gray-400">{label}:</span>
      <span
        className={
          iso === null
            ? "text-rose-600 font-medium"
            : isStale(iso, nowIso)
            ? "text-amber-700"
            : "text-gray-700"
        }
      >
        {formatted}
      </span>
    </span>
  );
}

function ThreeCsBadge({ aggregate }: { aggregate: number | null }) {
  if (aggregate === null) {
    return (
      <span
        className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-1 rounded"
        data-testid="attention-threecs-badge"
        title="Three Cs not yet rated"
      >
        no rating
      </span>
    );
  }
  const rounded = Math.round(aggregate * 10) / 10;
  const tone =
    aggregate >= 3
      ? "bg-emerald-100 text-emerald-800"
      : aggregate >= 2
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-800";
  return (
    <span
      className={
        "text-[11px] font-semibold tabular-nums px-2 py-1 rounded " + tone
      }
      data-testid="attention-threecs-badge"
      title="Three Cs aggregate (Choice / Causation / Change)"
    >
      {rounded.toFixed(1)}
    </span>
  );
}

// Pure helpers (formatRelative + isStale) live in ./unit-attention-helpers
// so tests can import them without crossing the JSX boundary (Lesson #71).
