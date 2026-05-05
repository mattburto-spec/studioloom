"use client";

/**
 * TG.0D.3 — TaskDrawer shell
 *
 * Right-side drawer (480px) with backdrop scrim, ESC + click-outside close
 * (with unsaved-changes confirm), tab nav, tab content slot, footer with
 * Save Draft / Publish / Cancel.
 *
 * Owns:
 *   - summativeReducer state
 *   - dirty tracking via initial-state ref
 *   - submit + error states
 *   - tab content switching (placeholder per tab — TG.0D.4 fills with
 *     real GraspsTab/SubmissionTab/RubricTab/TimelineTab/PolicyTab)
 *
 * Mount pattern matches src/components/teacher/class-hub/StudentDrawer.tsx
 * (fixed positioning, scrim z-40 + panel z-50, no portal needed).
 */

import { useEffect, useReducer, useRef, useState } from "react";
import {
  createSummativeTask,
  TaskApiError,
  updateTask,
} from "@/lib/tasks/client";
import type { AssessmentTask, UpdateTaskInput } from "@/lib/tasks/types";
import {
  buildSummativeCreateInput,
  errorCountsByTab,
  errorsByTab,
  INITIAL_SUMMATIVE_STATE,
  isSummativeFormReady,
  partitionTitleErrors,
  summativeReducer,
  validateSummativeForm,
  type SummativeFormState,
  type SummativeTabId,
} from "./summative-form-state";
import { isFormStateDirty } from "./TaskDrawer.types";
import TaskDrawerTabNav from "./TaskDrawerTabNav";
import GraspsTab from "./tabs/GraspsTab";
import SubmissionTab from "./tabs/SubmissionTab";
import RubricTab from "./tabs/RubricTab";
import TimelineTab from "./tabs/TimelineTab";
import PolicyTab from "./tabs/PolicyTab";

interface TaskDrawerProps {
  unitId: string;
  classId?: string | null;
  framework?: string | null;
  pages?: ReadonlyArray<{ id: string; title: string }>;
  /** Edit mode — when set, drawer hydrates from this task and saves via PATCH */
  editingTask?: AssessmentTask;
  onSaved: (task: AssessmentTask) => void;
  onClose: () => void;
}

function buildInitialState(
  task: AssessmentTask | undefined
): SummativeFormState {
  if (!task) return INITIAL_SUMMATIVE_STATE;
  return summativeReducer(INITIAL_SUMMATIVE_STATE, {
    type: "loadFromTask",
    task,
  });
}

export default function TaskDrawer({
  unitId,
  classId = null,
  framework,
  pages = [],
  editingTask,
  onSaved,
  onClose,
}: TaskDrawerProps) {
  const initial = useRef(buildInitialState(editingTask));
  const [state, dispatch] = useReducer(summativeReducer, initial.current);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const dirty = isFormStateDirty(state, initial.current);
  const errors = validateSummativeForm(state);
  const ready = isSummativeFormReady(state);
  const { title: titleErrors, rest: nonTitleErrors } = partitionTitleErrors(errors);
  // Tab badges only count tab-renderable errors. Title errors live in
  // the drawer header (no tab) so they don't roll up under any tab.
  const errorCounts = errorCountsByTab(nonTitleErrors);
  const errorsForActiveTab = errorsByTab(nonTitleErrors)[state.activeTab] ?? [];

  // Confirmed close — bypasses dirty guard
  function forceClose() {
    onClose();
  }

  // Guarded close — confirms when dirty
  function attemptClose() {
    if (dirty) {
      const ok = window.confirm(
        "You have unsaved changes. Discard them and close?"
      );
      if (!ok) return;
    }
    forceClose();
  }

  // ESC closes (with dirty guard)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        attemptClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  // Click-outside the panel closes (with dirty guard)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        attemptClose();
      }
    };
    // Defer one tick so the open-click doesn't immediately fire close
    const timer = setTimeout(
      () => document.addEventListener("mousedown", handler),
      0
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  async function handleSave(intent: "draft" | "publish") {
    if (!ready) {
      // If the only errors are title-only (which renders in the header,
      // not in any tab content), don't bounce to a tab — the title input
      // already has its inline error message + rose ring. Otherwise jump
      // to the first non-title-errored tab so the teacher sees what's missing.
      if (nonTitleErrors.length > 0) {
        const nonTitleCounts = errorCountsByTab(nonTitleErrors);
        const firstErroredTab = (
          Object.entries(nonTitleCounts) as Array<[SummativeTabId, number]>
        ).find(([, n]) => n > 0)?.[0];
        if (firstErroredTab && firstErroredTab !== state.activeTab) {
          dispatch({ type: "setActiveTab", tab: firstErroredTab });
        }
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const targetStatus = intent === "publish" ? "published" : "draft";
      let result: AssessmentTask;
      if (editingTask) {
        const payload = buildSummativeCreateInput(state, unitId, classId);
        const patch: UpdateTaskInput = {
          title: payload.title,
          status: targetStatus,
          config: payload.config,
          criteria: payload.criteria,
          linked_pages: state.timeline.linked_pages,
        };
        result = await updateTask(editingTask.id, patch);
      } else {
        result = await createSummativeTask({
          unit_id: unitId,
          class_id: classId,
          title: state.title.trim(),
          config: buildSummativeCreateInput(state, unitId, classId)
            .config as never,
          criteria: state.criteria.map((c) => ({ key: c.key, weight: c.weight })),
          status: targetStatus,
        });
      }
      onSaved(result);
      forceClose();
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

  return (
    <>
      {/* Backdrop scrim */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        aria-hidden="true"
        data-testid="task-drawer-scrim"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={editingTask ? "Edit project task" : "New project task"}
        className="fixed top-0 right-0 h-full w-[480px] max-w-[95vw] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        data-testid="task-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--le-hair)] flex-shrink-0">
          <div>
            <div className="le-cap text-[var(--le-ink-3)]">
              {editingTask ? "Edit project task" : "New project task"}
            </div>
            <input
              type="text"
              autoFocus={!editingTask}
              placeholder="Task title (e.g. Roller Coaster Brief)"
              value={state.title}
              onChange={(e) =>
                dispatch({ type: "setTitle", title: e.target.value })
              }
              maxLength={200}
              aria-invalid={titleErrors.length > 0}
              className={[
                "mt-1 w-full text-[14px] font-semibold px-2 py-1 -ml-2 rounded focus:outline-none focus:bg-[var(--le-paper)] focus:ring-1",
                titleErrors.length > 0
                  ? "ring-1 ring-rose-400 bg-rose-50/40"
                  : "focus:ring-violet-400",
              ].join(" ")}
              data-testid="task-drawer-title"
            />
            {titleErrors.length > 0 && (
              <div
                className="mt-0.5 ml-[-2px] text-[10.5px] text-rose-600"
                data-testid="task-drawer-title-error"
              >
                {titleErrors[0].message}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={attemptClose}
            className="ml-2 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition flex-shrink-0"
            aria-label="Close"
            data-testid="task-drawer-close"
          >
            ✕
          </button>
        </div>

        {/* Tab nav */}
        <TaskDrawerTabNav
          activeTab={state.activeTab}
          errorCountsByTab={errorCounts}
          onTabChange={(tab) => dispatch({ type: "setActiveTab", tab })}
        />

        {/* Tab content */}
        <div
          id={`task-drawer-tab-panel-${state.activeTab}`}
          role="tabpanel"
          className="flex-1 overflow-y-auto p-4"
          data-testid={`task-drawer-tab-content-${state.activeTab}`}
        >
          {errorsForActiveTab.length > 0 && (
            <div
              className="mb-3 px-2.5 py-2 bg-rose-50 border border-rose-200 rounded text-[11px]"
              data-testid={`task-drawer-tab-errors-${state.activeTab}`}
            >
              <div className="font-semibold text-rose-700 mb-1">
                {errorsForActiveTab.length === 1
                  ? "1 thing to fix on this tab:"
                  : `${errorsForActiveTab.length} things to fix on this tab:`}
              </div>
              <ul className="space-y-0.5 text-rose-700">
                {errorsForActiveTab.map((e, i) => (
                  <li
                    key={`${e.tab}-${e.field}-${i}`}
                    className="flex items-start gap-1"
                  >
                    <span className="text-rose-400">•</span>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.activeTab === "grasps" && (
            <GraspsTab state={state} dispatch={dispatch} />
          )}
          {state.activeTab === "submission" && (
            <SubmissionTab state={state} dispatch={dispatch} />
          )}
          {state.activeTab === "rubric" && (
            <RubricTab
              state={state}
              dispatch={dispatch}
              framework={framework}
            />
          )}
          {state.activeTab === "timeline" && (
            <TimelineTab
              state={state}
              dispatch={dispatch}
              unitId={unitId}
              pages={pages}
            />
          )}
          {state.activeTab === "policy" && (
            <PolicyTab state={state} dispatch={dispatch} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--le-hair)] px-4 py-3 flex items-center gap-2 flex-shrink-0">
          {submitError && (
            <div
              className="text-[11px] text-rose-600 mr-auto"
              data-testid="task-drawer-error"
            >
              {submitError}
            </div>
          )}
          {!submitError && !ready && (
            <div className="text-[11px] text-rose-600 mr-auto">
              {(() => {
                if (titleErrors.length > 0 && nonTitleErrors.length === 0) {
                  return "Set a title above to save";
                }
                const tabsWithErrors = (
                  Object.entries(errorCounts) as Array<
                    [SummativeTabId, number]
                  >
                )
                  .filter(([, n]) => n > 0)
                  .map(([t]) => t);
                if (tabsWithErrors.length === 1) {
                  return `Fix ${errors.length} thing${errors.length === 1 ? "" : "s"} on the ${tabsWithErrors[0]} tab`;
                }
                return `${errors.length} error${errors.length === 1 ? "" : "s"} across ${tabsWithErrors.length} tabs — click a tab to see what's missing`;
              })()}
            </div>
          )}
          {!submitError && ready && (
            <div className="ml-auto" />
          )}
          <button
            type="button"
            onClick={attemptClose}
            disabled={submitting}
            className="text-[11.5px] px-3 py-1.5 rounded text-[var(--le-ink-3)] hover:text-[var(--le-ink)] disabled:opacity-50"
            data-testid="task-drawer-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave("draft")}
            disabled={!ready || submitting}
            className="text-[11.5px] px-3 py-1.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            data-testid="task-drawer-save-draft"
          >
            {submitting ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="button"
            onClick={() => handleSave("publish")}
            disabled={!ready || submitting}
            className="text-[11.5px] px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            data-testid="task-drawer-publish"
          >
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </>
  );
}

