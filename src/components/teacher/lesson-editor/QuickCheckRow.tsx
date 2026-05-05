"use client";

/**
 * TG.0C.4 — QuickCheckRow inline form
 *
 * Lives inside TasksPanel (above the row list). 4 fields: title, criterion
 * (single-select pill picker per Matt's brief Q2 default), due date, linked
 * pages (optional). ↵ saves; ESC cancels.
 *
 * Single-select for v1 — server already supports multi via task_criterion_weights
 * if we flip the form-state shape later.
 */

import { useMemo, useReducer, useState, type FormEvent } from "react";
import {
  createQuickCheck,
  TaskApiError,
  updateTask,
} from "@/lib/tasks/client";
import {
  buildCreateInput,
  INITIAL_FORM_STATE,
  isQuickCheckFormReady,
  quickCheckReducer,
  type LinkedPage,
  type QuickCheckFormState,
} from "./quick-check-form-state";
import {
  getCriterionLabels,
  type FrameworkId,
} from "@/lib/frameworks/adapter";
import type { AssessmentTask } from "@/lib/tasks/types";
import type { NeutralCriterionKey } from "@/lib/pipeline/stages/stage4-neutral-validator";

interface QuickCheckRowProps {
  unitId: string;
  classId?: string | null;
  framework?: string | null;
  /** All lessons in the unit, for the linked-pages picker. */
  pages?: ReadonlyArray<{ id: string; title: string }>;
  /** When set, the row is in edit mode — saves via PATCH. */
  editingTask?: AssessmentTask;
  onSaved: (task: AssessmentTask) => void;
  onCancel: () => void;
}

function buildInitialState(
  task: AssessmentTask | undefined
): QuickCheckFormState {
  if (!task) return INITIAL_FORM_STATE;
  const config = task.config as Record<string, unknown>;
  return {
    title: task.title,
    criterion: (task.criteria[0] as QuickCheckFormState["criterion"]) ?? null,
    dueDate: typeof config.due_date === "string" ? config.due_date : "",
    linkedPages: task.linked_pages.map((lp) => ({
      unit_id: lp.unit_id,
      page_id: lp.page_id,
    })),
  };
}

export default function QuickCheckRow({
  unitId,
  classId = null,
  framework,
  pages = [],
  editingTask,
  onSaved,
  onCancel,
}: QuickCheckRowProps) {
  const initial = useMemo(() => buildInitialState(editingTask), [editingTask]);
  const [state, dispatch] = useReducer(quickCheckReducer, initial);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Build the criterion list for the pill picker. One pill per criterion
  // group (e.g. MYP A/B/C/D) — clicking maps the group to one neutral key.
  const criterionPills = (() => {
    if (!framework) return [];
    try {
      const defs = getCriterionLabels(framework as FrameworkId);
      return defs.map((d) => ({
        short: d.short,
        full: d.full,
        // Use the first neutralKey as the "representative" of this group.
        // In MYP each criterion has 1-2 neutralKeys; we take [0] for v1.
        // TG.0D summative will surface the full mapping.
        neutralKey: d.neutralKeys[0],
      }));
    } catch {
      return [];
    }
  })();

  const ready = isQuickCheckFormReady(state) && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildCreateInput(state, unitId, classId);
      let task: AssessmentTask;
      if (editingTask) {
        task = await updateTask(editingTask.id, {
          title: payload.title,
          config: payload.config,
          criteria: payload.criteria,
          linked_pages: state.linkedPages,
        });
      } else {
        task = await createQuickCheck({
          unit_id: payload.unit_id,
          class_id: payload.class_id,
          title: payload.title,
          criteria: payload.criteria,
          due_date: state.dueDate || undefined,
          linked_pages:
            state.linkedPages.length > 0 ? state.linkedPages : undefined,
        });
      }
      onSaved(task);
    } catch (err) {
      const msg =
        err instanceof TaskApiError
          ? `${err.message}${err.details.length > 0 ? ` (${err.details.join("; ")})` : ""}`
          : err instanceof Error
            ? err.message
            : "Failed to save task";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="px-2 py-2 border border-violet-300 rounded bg-violet-50 mb-1.5"
      data-testid="quick-check-row"
    >
      <input
        type="text"
        autoFocus
        placeholder="Quick-check title (e.g. Quiz 1, Sketch check)"
        value={state.title}
        onChange={(e) => dispatch({ type: "setTitle", title: e.target.value })}
        maxLength={200}
        className="w-full text-[11.5px] font-semibold px-2 py-1 bg-white border border-[var(--le-hair)] rounded focus:outline-none focus:border-violet-500"
        data-testid="quick-check-title"
      />

      {/* Criterion pills */}
      <div className="mt-1.5">
        <div className="text-[10px] text-[var(--le-ink-3)] mb-1">Criterion</div>
        <div className="flex flex-wrap gap-1">
          {criterionPills.length === 0 && (
            <div className="text-[10px] text-rose-500 italic">
              No framework set on this class — set framework to pick criterion
            </div>
          )}
          {criterionPills.map((pill) => {
            const selected = state.criterion === pill.neutralKey;
            return (
              <button
                key={pill.short}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "setCriterion",
                    criterion: selected
                      ? null
                      : (pill.neutralKey as NeutralCriterionKey),
                  })
                }
                className={[
                  "text-[10.5px] px-2 py-0.5 rounded-full border",
                  selected
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-[var(--le-ink)] border-[var(--le-hair)] hover:border-violet-400",
                ].join(" ")}
                title={pill.full}
                data-testid={`quick-check-criterion-${pill.short}`}
              >
                {pill.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Due date */}
      <div className="mt-1.5 flex items-center gap-2">
        <label className="text-[10px] text-[var(--le-ink-3)]">Due</label>
        <input
          type="date"
          value={state.dueDate}
          onChange={(e) =>
            dispatch({ type: "setDueDate", dueDate: e.target.value })
          }
          className="text-[10.5px] px-1.5 py-0.5 bg-white border border-[var(--le-hair)] rounded focus:outline-none focus:border-violet-500"
          data-testid="quick-check-due"
        />
        {state.dueDate && (
          <button
            type="button"
            onClick={() => dispatch({ type: "setDueDate", dueDate: "" })}
            className="text-[10px] text-[var(--le-ink-3)] hover:text-[var(--le-ink)] underline-offset-2 hover:underline"
          >
            clear
          </button>
        )}
      </div>

      {/* Linked pages (optional) */}
      {pages.length > 0 && (
        <div className="mt-1.5">
          <div className="text-[10px] text-[var(--le-ink-3)] mb-1">
            Linked lessons (optional)
          </div>
          <div className="flex flex-wrap gap-1">
            {pages.map((p) => {
              const isLinked = state.linkedPages.some(
                (lp) => lp.unit_id === unitId && lp.page_id === p.id
              );
              const page: LinkedPage = { unit_id: unitId, page_id: p.id };
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => dispatch({ type: "togglePage", page })}
                  className={[
                    "text-[10px] px-1.5 py-0.5 rounded border",
                    isLinked
                      ? "bg-violet-100 text-violet-900 border-violet-300"
                      : "bg-white text-[var(--le-ink-3)] border-[var(--le-hair)] hover:border-violet-300",
                  ].join(" ")}
                  data-testid={`quick-check-page-${p.id}`}
                >
                  {p.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {submitError && (
        <div className="mt-1.5 text-[10.5px] text-rose-600">
          {submitError}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={!ready}
          className={[
            "text-[10.5px] px-2 py-1 rounded font-semibold transition-colors",
            ready
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-[var(--le-hair)] text-[var(--le-ink-3)] cursor-not-allowed",
          ].join(" ")}
          data-testid="quick-check-save"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10.5px] px-2 py-1 rounded text-[var(--le-ink-3)] hover:text-[var(--le-ink)]"
          data-testid="quick-check-cancel"
        >
          Cancel
        </button>
        <span className="ml-auto text-[9.5px] text-[var(--le-ink-3)]">
          ⏎ to save · ESC to cancel
        </span>
      </div>
    </form>
  );
}
