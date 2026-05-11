"use client";

/**
 * AG.3.4 — TimelineBoard
 *
 * Top-level Timeline component. Renders:
 *   - Save indicator
 *   - Race day input (informational anchor)
 *   - Ordered list of milestones (orderedMilestones helper)
 *   - "+ Add milestone" affordance (modal composer — round 21; was window prompt in v1)
 *   - Up/down reorder buttons per row
 *
 * Backward-mapping flow: student sets race day → adds milestones with
 * earlier target dates. Forward-planning flow: student marks milestones
 * done as they complete them; variance traffic-lights show urgency.
 */

import { useState } from "react";
import {
  orderedMilestones,
  findNextPendingTargeted,
} from "@/lib/unit-tools/timeline/reducer";
import TimelineMilestoneRow from "./TimelineMilestoneRow";
import TimelineAddMilestoneModal from "./TimelineAddMilestoneModal";
import { useTimelineBoard } from "./use-timeline-board";

interface TimelineBoardProps {
  unitId: string;
  /** Optional override for "now" — used by tests to assert variance rendering deterministically. Defaults to live Date.now(). */
  nowIso?: string;
}

export default function TimelineBoard({ unitId, nowIso }: TimelineBoardProps) {
  const board = useTimelineBoard({ unitId });
  const { state, loadStatus, loadError, save, dispatch, flushSave } = board;

  // For variance computations, use prop or current time
  const [renderNowIso] = useState(() => nowIso ?? new Date().toISOString());

  // Round 21 — Add Milestone composer state. Replaces the v1 native
  // window-prompt-x2 flow with a proper modal (label + date picker).
  const [addOpen, setAddOpen] = useState(false);

  // ─── LOAD STATES ─────────────────────────────────────────────────────────

  if (loadStatus === "loading" || loadStatus === "idle") {
    return (
      <div
        className="text-[12px] text-gray-500 italic p-4"
        data-testid="timeline-loading"
      >
        Loading your timeline...
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div
        className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-3"
        data-testid="timeline-load-error"
      >
        Couldn&apos;t load Timeline: {loadError ?? "unknown error"}.{" "}
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

  // ─── BOARD ──────────────────────────────────────────────────────────────

  const ordered = orderedMilestones(state);
  const next = findNextPendingTargeted(state);

  function handleAddMilestoneSubmit(label: string, targetDate: string | null) {
    dispatch({
      type: "addMilestone",
      label,
      targetDate,
    });
    setAddOpen(false);
  }

  function handleSetRaceDate(value: string) {
    dispatch({
      type: "setRaceDate",
      date: value === "" ? null : value,
    });
  }

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="timeline-board"
      data-unit-id={unitId}
    >
      {/* Save indicator */}
      <div className="flex items-center gap-2 text-[10.5px] text-gray-500 px-1">
        <span className="font-semibold uppercase tracking-wide">Timeline</span>
        <span className="text-gray-300">·</span>
        {save.isSaving ? (
          <span data-testid="timeline-save-status">Saving...</span>
        ) : save.error ? (
          <span className="text-rose-600" data-testid="timeline-save-status">
            Save failed.{" "}
            <button
              type="button"
              onClick={flushSave}
              className="underline underline-offset-2"
            >
              Retry
            </button>
          </span>
        ) : save.isDirty ? (
          <span data-testid="timeline-save-status">Pending changes...</span>
        ) : save.lastSavedAt ? (
          <span data-testid="timeline-save-status">Saved</span>
        ) : (
          <span data-testid="timeline-save-status">Up to date</span>
        )}

        {next && (
          <>
            <span className="text-gray-300">·</span>
            <span
              className="ml-auto text-gray-700"
              title="Next pending milestone"
              data-testid="timeline-next-milestone"
            >
              ⏭ {next.label}
              {next.targetDate && (
                <span className="text-gray-500 ml-1">
                  ({next.targetDate})
                </span>
              )}
            </span>
          </>
        )}
      </div>

      {/* Project end date (was "Race day" — kept that label for CO2 Racers unit; generic phrasing here). */}
      <label className="flex items-center gap-2 px-1 py-1 bg-violet-50 border border-violet-200 rounded text-[11.5px]">
        <span className="font-semibold text-violet-900 uppercase tracking-wide">
          🏁 Project end
        </span>
        <input
          type="date"
          value={state.raceDate ?? ""}
          onChange={(e) => handleSetRaceDate(e.target.value)}
          className="text-[11.5px] px-1.5 py-0.5 bg-white border border-violet-300 rounded focus:outline-none focus:border-violet-500"
          data-testid="timeline-race-date"
        />
        <span className="text-violet-700 text-[10px] ml-auto">
          Set this first, then backward-map
        </span>
      </label>

      {/* Milestones list */}
      <div className="flex flex-col gap-1.5">
        {ordered.length === 0 && (
          <div
            className="text-[11px] text-gray-400 italic text-center py-3 bg-gray-50 rounded border border-dashed border-gray-300"
            data-testid="timeline-empty"
          >
            No milestones yet. Set your project end date above, then add milestones working backwards.
          </div>
        )}
        <ul className="flex flex-col gap-1.5">
          {ordered.map((m, idx) => (
            <TimelineMilestoneRow
              key={m.id}
              milestone={m}
              nowIso={renderNowIso}
              canMoveUp={idx > 0}
              canMoveDown={idx < ordered.length - 1}
              onUpdateLabel={(label) =>
                dispatch({ type: "updateLabel", milestoneId: m.id, label })
              }
              onSetTargetDate={(date) =>
                dispatch({ type: "setTargetDate", milestoneId: m.id, date })
              }
              onMarkDone={() =>
                dispatch({ type: "markDone", milestoneId: m.id })
              }
              onMarkPending={() =>
                dispatch({ type: "markPending", milestoneId: m.id })
              }
              onDelete={() =>
                dispatch({ type: "deleteMilestone", milestoneId: m.id })
              }
              onMoveUp={() => {
                if (idx === 0) return;
                const ids = ordered.map((x) => x.id);
                [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                dispatch({ type: "reorderMilestones", orderedIds: ids });
              }}
              onMoveDown={() => {
                if (idx === ordered.length - 1) return;
                const ids = ordered.map((x) => x.id);
                [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                dispatch({ type: "reorderMilestones", orderedIds: ids });
              }}
            />
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="self-start text-[11px] text-gray-500 hover:text-violet-700 hover:bg-violet-50 border border-dashed border-gray-300 hover:border-violet-300 rounded px-3 py-1 transition-colors"
        data-testid="timeline-add-milestone"
      >
        + Add milestone
      </button>

      {/* Round 21 — Add milestone modal (replaces native v1 prompt x2) */}
      {addOpen && (
        <TimelineAddMilestoneModal
          onSubmit={handleAddMilestoneSubmit}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
