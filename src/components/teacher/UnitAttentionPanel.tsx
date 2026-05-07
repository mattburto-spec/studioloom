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

import { useEffect, useState, useCallback } from "react";
import {
  loadAttentionPanel,
  AttentionApiError,
} from "@/lib/unit-tools/attention/client";
import type { AttentionPanelData, AttentionRow } from "@/lib/unit-tools/attention/types";
import { formatRelative, isStale } from "./unit-attention-helpers";
import CalibrationMiniView from "./CalibrationMiniView";

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
  // Calibration mini-view state — opens when a row is clicked. Holds
  // just the student identity; the modal fetches its own per-element
  // data on mount.
  const [calibrationFor, setCalibrationFor] = useState<{
    studentId: string;
    studentDisplayName: string;
  } | null>(null);
  // Bumped every time the calibration modal saves — re-trigger panel
  // load so the row's "Calibration: today" + Three Cs aggregate update.
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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
  }, [unitId, classId, refreshKey]);

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

  const suggestedCount = data.rows.filter((r) => r.suggestedOneOnOne).length;

  return (
    <div className="flex flex-col gap-3" data-testid="attention-panel">
      <DontRescueBanner />

      {/* Round 7 — short legend so teachers know what each signal means.
          Without it "1:1", "Calibration: never", and "no rating" all
          read as cryptic. */}
      <details
        className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
        data-testid="attention-legend"
      >
        <summary className="cursor-pointer font-semibold text-gray-700 hover:text-violet-700">
          What do these mean?
        </summary>
        <dl className="mt-2 space-y-1.5 leading-snug">
          <div>
            <dt className="inline font-semibold text-gray-800">Suggested 1:1:</dt>{" "}
            <dd className="inline">
              Bottom-third by Three Cs aggregate — the rotation target for a
              quick one-on-one mentor chat today.
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-800">Three Cs:</dt>{" "}
            <dd className="inline">
              Choice / Causation / Change. Comes from New Metrics survey
              blocks (student self-rating, 1–3) plus your teacher
              observations (1–4).{" "}
              <span className="text-amber-700 font-semibold">
                Reflects the rating button picked, NOT the quality of the
                written answer.
              </span>{" "}
              Use it to spot rotation targets, then verify the entries
              behind it during the 1-on-1 chat.
              <span className="text-gray-500"> Add a New Metrics block in any lesson to start collecting.</span>
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-800">Calibration:</dt>{" "}
            <dd className="inline">
              When you last recorded a teacher observation for that student
              (side-by-side rating against their self-rating). &ldquo;Never&rdquo; means no
              observation recorded yet for this unit.
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-800">Journal / Kanban:</dt>{" "}
            <dd className="inline">
              When the student last saved a Process Journal entry / moved a
              card on their Project Board.
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-800">Cards:</dt>{" "}
            <dd className="inline">
              Pulse check on Project Board engagement —{" "}
              <span className="font-mono">N · M done</span> means N total
              cards across all four columns, M of them in Done.{" "}
              <span className="text-rose-700 font-medium">none</span> = the
              student hasn&apos;t added any cards yet.
            </dd>
          </div>
        </dl>
      </details>

      <div className="text-[10.5px] uppercase tracking-wide text-gray-500 px-1 flex items-center gap-2">
        <span className="font-semibold">Attention rotation</span>
        <span className="text-gray-300">·</span>
        <span>{data.rows.length} students</span>
        <span className="text-gray-300">·</span>
        <span title="Bottom-third by Three Cs aggregate score">
          {suggestedCount} suggested for 1-on-1
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.rows.map((row) => (
          <AttentionRowItem
            key={row.studentId}
            row={row}
            nowIso={data.nowIso}
            onClick={() =>
              setCalibrationFor({
                studentId: row.studentId,
                studentDisplayName: row.displayName,
              })
            }
          />
        ))}
      </ul>

      {calibrationFor && (
        <CalibrationMiniView
          unitId={unitId}
          classId={classId}
          studentId={calibrationFor.studentId}
          studentDisplayName={calibrationFor.studentDisplayName}
          onClose={() => setCalibrationFor(null)}
          onSaved={reload}
        />
      )}
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
  /** Click → open the calibration mini-view for this student. */
  onClick: () => void;
}

function AttentionRowItem({ row, nowIso, onClick }: AttentionRowItemProps) {
  const aggregate = row.threeCs.aggregate;

  return (
    <li
      className={
        "flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors " +
        (row.suggestedOneOnOne
          ? "bg-violet-50 border-violet-300 hover:bg-violet-100"
          : "bg-white border-gray-200 hover:border-violet-300 hover:bg-violet-50/40")
      }
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title={`Open calibration mini-view for ${row.displayName}`}
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
              title="Bottom-third by Three Cs aggregate. Quick mentor chat suggested today."
              data-testid="attention-1on1-badge"
            >
              Suggested 1-on-1
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-gray-500 mt-0.5">
          <SignalCell
            label="Journal"
            iso={row.lastJournalAt}
            nowIso={nowIso}
            tooltip="Last Process Journal entry the student saved in this unit."
            testId="attention-signal-journal"
          />
          <SignalCell
            label="Kanban"
            iso={row.lastKanbanMoveAt}
            nowIso={nowIso}
            tooltip="Last time the student moved a card on their Project Board."
            testId="attention-signal-kanban"
          />
          <KanbanPulseCell
            total={row.kanbanTotalCards}
            done={row.kanbanDoneCount}
          />
          <SignalCell
            label="Calibration"
            iso={row.lastCalibrationAt}
            nowIso={nowIso}
            tooltip="Last time YOU recorded a teacher observation for this student. 'Never' = no observation logged for this unit yet."
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
  /** Native-title tooltip explaining what this signal means. */
  tooltip?: string;
  testId: string;
}

function SignalCell({ label, iso, nowIso, tooltip, testId }: SignalCellProps) {
  const formatted = formatRelative(iso, nowIso);
  return (
    <span
      className="flex items-center gap-1"
      title={tooltip}
      data-testid={testId}
    >
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

/**
 * Compact "📋 N · ✅ M" pill showing total card count + done count for the
 * student's kanban on this unit. Pulse-check signal: zero = no engagement,
 * low total = barely using the board, healthy ratio of done/total = active
 * project management.
 */
function KanbanPulseCell({ total, done }: { total: number; done: number }) {
  const tone =
    total === 0
      ? "text-rose-600 font-medium"
      : total < 3
      ? "text-amber-700"
      : "text-gray-700";
  return (
    <span
      className="flex items-center gap-1"
      title={
        total === 0
          ? "Empty project board — student hasn't added any cards yet."
          : `${total} card${total === 1 ? "" : "s"} on board, ${done} done.`
      }
      data-testid="attention-signal-kanban-pulse"
    >
      <span className="text-gray-400">Cards:</span>
      <span className={tone}>
        {total === 0 ? "none" : `${total} · ${done} done`}
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
        title="No Three Cs rating yet for this student. Add a New Metrics block to a lesson — students self-rate at the end, or you can record a teacher observation directly."
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
      title={`Three Cs aggregate. Average of self-rating values picked by the student (1–3 scale) and any teacher observations (1–4 scale). Reflects which BUTTON they chose, NOT the quality of their written response — verify the underlying entries before drawing conclusions.`}
    >
      {rounded.toFixed(1)}
    </span>
  );
}

// Pure helpers (formatRelative + isStale) live in ./unit-attention-helpers
// so tests can import them without crossing the JSX boundary (Lesson #71).
