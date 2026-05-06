"use client";

/**
 * AG.3.4 — TimelineMilestoneRow
 *
 * One row per milestone:
 *   - Variance dot (green/amber/rose/gray) based on computeVariance
 *   - Status checkbox (pending/done)
 *   - Inline label edit on focus
 *   - Inline target date input
 *   - Up/down reorder buttons
 *   - Delete (gated for anchored milestones)
 *
 * Pure presentation. Parent owns state via reducer dispatch.
 */

import { useState } from "react";
import {
  computeVariance,
  type TimelineClock,
} from "@/lib/unit-tools/timeline/reducer";
import type { TimelineMilestone } from "@/lib/unit-tools/timeline/types";

interface TimelineMilestoneRowProps {
  milestone: TimelineMilestone;
  /** ISO YYYY-MM-DD or full ISO. Used by computeVariance against target. */
  nowIso: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdateLabel: (label: string) => void;
  onSetTargetDate: (date: string | null) => void;
  onMarkDone: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const VARIANCE_DOT: Record<
  "on_track" | "tight" | "behind" | "no_target",
  { className: string; title: string }
> = {
  on_track: {
    className: "bg-emerald-500",
    title: "On track — target is 2+ days away",
  },
  tight: {
    className: "bg-amber-500",
    title: "Tight — target is today or tomorrow",
  },
  behind: {
    className: "bg-rose-500",
    title: "Behind — target date has passed",
  },
  no_target: {
    className: "bg-gray-300",
    title: "No target date set",
  },
};

export default function TimelineMilestoneRow({
  milestone,
  nowIso,
  canMoveUp,
  canMoveDown,
  onUpdateLabel,
  onSetTargetDate,
  onMarkDone,
  onMarkPending,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TimelineMilestoneRowProps) {
  const isDone = milestone.status === "done";
  const variance = isDone
    ? null
    : computeVariance(milestone.targetDate, nowIso);
  const dotKey = variance ?? "no_target";
  const dot = VARIANCE_DOT[dotKey];

  const [labelDraft, setLabelDraft] = useState(milestone.label);

  function commitLabel() {
    if (labelDraft.trim() && labelDraft !== milestone.label) {
      onUpdateLabel(labelDraft);
    } else if (!labelDraft.trim()) {
      // Don't dispatch empty; revert
      setLabelDraft(milestone.label);
    }
  }

  return (
    <li
      className={[
        "flex items-center gap-2 p-2 rounded border bg-white",
        isDone
          ? "border-gray-200 opacity-75"
          : "border-gray-200 hover:border-violet-200",
      ].join(" ")}
      data-testid={`timeline-milestone-row-${milestone.id}`}
      data-milestone-status={milestone.status}
    >
      {/* Variance dot */}
      <span
        className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${dot.className}`}
        title={dot.title}
        aria-label={dot.title}
        data-testid={`timeline-milestone-variance-${milestone.id}`}
        data-variance={dotKey}
      />

      {/* Status checkbox */}
      <input
        type="checkbox"
        checked={isDone}
        onChange={(e) => (e.target.checked ? onMarkDone() : onMarkPending())}
        className="flex-shrink-0 rounded text-violet-600 focus:ring-violet-400"
        title={isDone ? "Mark as pending" : "Mark as done"}
        data-testid={`timeline-milestone-checkbox-${milestone.id}`}
      />

      {/* Anchor indicator */}
      {milestone.isAnchor && (
        <span
          className="flex-shrink-0 text-[10px] uppercase tracking-wide text-violet-700 font-bold"
          title="Anchored milestone (can't be deleted)"
        >
          ⚓
        </span>
      )}

      {/* Label (inline edit) */}
      <input
        type="text"
        value={labelDraft}
        onChange={(e) => setLabelDraft(e.target.value)}
        onBlur={commitLabel}
        maxLength={200}
        className={[
          "flex-1 text-[12px] px-1 py-0.5 bg-transparent rounded border border-transparent",
          isDone ? "line-through text-gray-500" : "text-gray-900",
          "focus:outline-none focus:bg-white focus:border-violet-300 focus:ring-1 focus:ring-violet-200",
        ].join(" ")}
        data-testid={`timeline-milestone-label-${milestone.id}`}
      />

      {/* Target date */}
      <input
        type="date"
        value={milestone.targetDate ?? ""}
        onChange={(e) =>
          onSetTargetDate(e.target.value === "" ? null : e.target.value)
        }
        className="flex-shrink-0 text-[11px] px-1.5 py-0.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-violet-400"
        data-testid={`timeline-milestone-date-${milestone.id}`}
      />

      {/* Reorder + delete */}
      <div className="flex-shrink-0 flex items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="text-[11px] text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-1"
          title="Move up"
          aria-label="Move up"
          data-testid={`timeline-milestone-up-${milestone.id}`}
        >
          ▲
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="text-[11px] text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-1"
          title="Move down"
          aria-label="Move down"
          data-testid={`timeline-milestone-down-${milestone.id}`}
        >
          ▼
        </button>
        {!milestone.isAnchor && (
          <button
            type="button"
            onClick={onDelete}
            className="text-[11px] text-gray-400 hover:text-rose-600 px-1"
            title="Delete milestone"
            aria-label="Delete"
            data-testid={`timeline-milestone-delete-${milestone.id}`}
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

// Re-export utilities for tests + parent use
export type { TimelineClock };
