"use client";

/**
 * TG.0D.4 — Tab 4 (Timeline)
 *
 * Due date + late policy + resubmission (off / open-until / max-attempts)
 * + linked-lessons multi-select pills.
 */

import type { Dispatch } from "react";
import type {
  SummativeAction,
  SummativeFormState,
} from "../summative-form-state";

interface TimelineTabProps {
  state: SummativeFormState;
  dispatch: Dispatch<SummativeAction>;
  unitId: string;
  pages?: ReadonlyArray<{ id: string; title: string }>;
}

export default function TimelineTab({
  state,
  dispatch,
  unitId,
  pages = [],
}: TimelineTabProps) {
  const t = state.timeline;
  return (
    <div className="space-y-4">
      {/* Due date */}
      <label className="block">
        <span className="le-cap text-[var(--le-ink-3)] block mb-1">
          Due date
        </span>
        <input
          type="date"
          value={t.due_date}
          onChange={(e) =>
            dispatch({
              type: "setTimelineField",
              field: "due_date",
              value: e.target.value,
            })
          }
          className="text-[11.5px] px-2 py-1 bg-white border border-[var(--le-hair)] rounded focus:outline-none focus:border-violet-500"
          data-testid="timeline-due-date"
        />
      </label>

      {/* Late policy */}
      <label className="block">
        <span className="le-cap text-[var(--le-ink-3)] block mb-1">
          Late policy (optional)
        </span>
        <textarea
          rows={2}
          placeholder="e.g. 1 day grace, then 10% per day; max 3 days late"
          value={t.late_policy}
          onChange={(e) =>
            dispatch({
              type: "setTimelineField",
              field: "late_policy",
              value: e.target.value,
            })
          }
          maxLength={500}
          className="w-full text-[11.5px] px-2 py-1.5 bg-white border border-[var(--le-hair)] rounded resize-y focus:outline-none focus:border-violet-500"
          data-testid="timeline-late-policy"
        />
      </label>

      {/* Resubmission */}
      <fieldset>
        <legend className="le-cap text-[var(--le-ink-3)] mb-1.5">
          Resubmission
        </legend>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-[11.5px] cursor-pointer">
            <input
              type="radio"
              name="resub-mode"
              checked={t.resubmission_mode === "off"}
              onChange={() =>
                dispatch({
                  type: "setTimelineField",
                  field: "resubmission_mode",
                  value: "off",
                })
              }
              className="text-violet-600 focus:ring-violet-400"
              data-testid="timeline-resub-off"
            />
            <span>Off (single submission)</span>
          </label>
          <label className="flex items-center gap-2 text-[11.5px] cursor-pointer">
            <input
              type="radio"
              name="resub-mode"
              checked={t.resubmission_mode === "open_until"}
              onChange={() =>
                dispatch({
                  type: "setTimelineField",
                  field: "resubmission_mode",
                  value: "open_until",
                })
              }
              className="text-violet-600 focus:ring-violet-400"
              data-testid="timeline-resub-open-until"
            />
            <span>Open until a deadline</span>
            {t.resubmission_mode === "open_until" && (
              <input
                type="date"
                value={t.resubmission_until}
                onChange={(e) =>
                  dispatch({
                    type: "setTimelineField",
                    field: "resubmission_until",
                    value: e.target.value,
                  })
                }
                className="ml-2 text-[11px] px-1.5 py-0.5 bg-white border border-[var(--le-hair)] rounded focus:outline-none focus:border-violet-500"
                data-testid="timeline-resub-until-date"
              />
            )}
          </label>
          <label className="flex items-center gap-2 text-[11.5px] cursor-pointer">
            <input
              type="radio"
              name="resub-mode"
              checked={t.resubmission_mode === "max_attempts"}
              onChange={() =>
                dispatch({
                  type: "setTimelineField",
                  field: "resubmission_mode",
                  value: "max_attempts",
                })
              }
              className="text-violet-600 focus:ring-violet-400"
              data-testid="timeline-resub-max-attempts"
            />
            <span>Max attempts</span>
            {t.resubmission_mode === "max_attempts" && (
              <input
                type="number"
                min={1}
                max={10}
                value={t.resubmission_max}
                onChange={(e) =>
                  dispatch({
                    type: "setTimelineField",
                    field: "resubmission_max",
                    value: e.target.value,
                  })
                }
                placeholder="N"
                className="ml-2 text-[11px] px-1.5 py-0.5 w-14 text-right bg-white border border-[var(--le-hair)] rounded focus:outline-none focus:border-violet-500"
                data-testid="timeline-resub-max-input"
              />
            )}
          </label>
        </div>
      </fieldset>

      {/* Linked lessons */}
      {pages.length > 0 && (
        <div>
          <div className="le-cap text-[var(--le-ink-3)] mb-1">
            Linked lessons (optional)
          </div>
          <div className="text-[10px] text-[var(--le-ink-3)] mb-1.5">
            Select the lessons that build toward this task. Empty = any work in this unit.
          </div>
          <div className="flex flex-wrap gap-1">
            {pages.map((p) => {
              const isLinked = t.linked_pages.some(
                (lp) => lp.unit_id === unitId && lp.page_id === p.id
              );
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "toggleLinkedPage",
                      page: { unit_id: unitId, page_id: p.id },
                    })
                  }
                  className={[
                    "text-[10.5px] px-1.5 py-0.5 rounded border",
                    isLinked
                      ? "bg-violet-100 text-violet-900 border-violet-300"
                      : "bg-white text-[var(--le-ink-3)] border-[var(--le-hair)] hover:border-violet-300",
                  ].join(" ")}
                  data-testid={`timeline-page-${p.id}`}
                >
                  {p.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
