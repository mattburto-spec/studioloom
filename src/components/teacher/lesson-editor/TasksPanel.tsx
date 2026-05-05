"use client";

/**
 * TG.0C.3 — Tasks panel sidebar (read-only first; write actions land in TG.0C.4).
 *
 * Mounts in the lesson editor's left column, BETWEEN UnitThumbnailEditor and
 * LessonSidebar. Same architectural slot as LessonSidebar — a sibling component,
 * not a category inside BlockPalette (the right-column blocks ≠ left-column
 * lesson list/tasks).
 *
 * Per OS-seam principle: keeps domain-specific vocabulary in props (titles,
 * empty-state copy) so a future Loominary product can swap "Tasks" for its
 * own vocabulary without forking the component.
 */

import { useEffect, useState } from "react";
import { listTasksForUnit } from "@/lib/tasks/client";
import type { AssessmentTask } from "@/lib/tasks/types";
import {
  buildCriterionLabelMap,
  formatTaskRow,
  type TaskRowDisplay,
} from "./TasksPanel.types";
import { getCriterionLabels, type FrameworkId } from "@/lib/frameworks/adapter";
import AddTaskChooser from "./AddTaskChooser";
import QuickCheckRow from "./QuickCheckRow";

type AddMode = "idle" | "chooser" | "quickCheck";

interface TasksPanelProps {
  unitId: string;
  classId?: string | null;
  framework?: string | null;
  /** Lessons in the unit, for the QuickCheckRow linked-pages picker. */
  pages?: ReadonlyArray<{ id: string; title: string }>;
}

export default function TasksPanel({
  unitId,
  classId = null,
  framework,
  pages = [],
}: TasksPanelProps) {
  const [tasks, setTasks] = useState<AssessmentTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("idle");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listTasksForUnit(unitId)
      .then((data) => {
        if (!cancelled) {
          setTasks(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tasks");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const labelMap = (() => {
    if (!framework) return new Map();
    try {
      const defs = getCriterionLabels(framework as FrameworkId);
      return buildCriterionLabelMap(framework as FrameworkId, defs);
    } catch {
      return new Map();
    }
  })();

  const rows: TaskRowDisplay[] = (tasks ?? []).map((t) =>
    formatTaskRow(t, labelMap)
  );

  function handleSaved(task: AssessmentTask) {
    setTasks((prev) => [...(prev ?? []), task]);
    setAddMode("idle");
  }

  return (
    <div className="px-3 py-2.5 border-b border-[var(--le-hair)] flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="le-cap text-[var(--le-ink-3)]">
          Tasks{rows.length > 0 ? ` (${rows.length})` : ""}
        </div>
        {addMode === "idle" && (
          <button
            type="button"
            onClick={() => setAddMode("chooser")}
            className="text-[10.5px] text-[var(--le-ink-3)] hover:text-[var(--le-ink)] underline-offset-2 hover:underline"
            data-testid="tasks-panel-add"
          >
            + Add task
          </button>
        )}
      </div>

      {addMode === "chooser" && (
        <AddTaskChooser
          onChooseQuickCheck={() => setAddMode("quickCheck")}
          onCancel={() => setAddMode("idle")}
        />
      )}

      {addMode === "quickCheck" && (
        <QuickCheckRow
          unitId={unitId}
          classId={classId}
          framework={framework}
          pages={pages}
          onSaved={handleSaved}
          onCancel={() => setAddMode("idle")}
        />
      )}

      {loading && (
        <div className="text-[10.5px] text-[var(--le-ink-3)] italic">
          Loading…
        </div>
      )}

      {error && (
        <div className="text-[10.5px] text-rose-600">
          Couldn&apos;t load tasks: {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-[10.5px] text-[var(--le-ink-3)] italic leading-snug">
          No tasks configured yet. Backward design starts here →
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="px-2 py-1.5 bg-[var(--le-paper)] border border-[var(--le-hair)] rounded text-[11px] leading-tight"
              data-testid="tasks-panel-row"
              data-task-id={row.id}
            >
              <div className="flex items-center gap-1.5 font-semibold text-[var(--le-ink)]">
                <span aria-hidden="true">{row.icon}</span>
                <span className="truncate">{row.title}</span>
                {row.statusBadge && (
                  <span className="ml-auto text-[9.5px] text-[var(--le-ink-3)]">
                    {row.statusBadge}
                  </span>
                )}
              </div>
              <div className="text-[10.5px] text-[var(--le-ink-3)] mt-0.5 flex items-center gap-1.5">
                {row.criterionLine && <span>{row.criterionLine}</span>}
                {row.criterionLine && row.dueLine && <span>·</span>}
                {row.dueLine && <span>{row.dueLine}</span>}
                {row.isSummative && (
                  <span className="ml-auto text-[var(--le-ink-2)]">
                    [Configure →]
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
