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
import { listTasksForUnit, deleteTask, TaskApiError } from "@/lib/tasks/client";
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSaved(task: AssessmentTask) {
    setTasks((prev) => {
      const list = prev ?? [];
      const existingIdx = list.findIndex((t) => t.id === task.id);
      if (existingIdx >= 0) {
        const next = list.slice();
        next[existingIdx] = task;
        return next;
      }
      return [...list, task];
    });
    setAddMode("idle");
    setEditingId(null);
  }

  async function handleDelete(taskId: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    setDeletingId(taskId);
    try {
      await deleteTask(taskId);
      setTasks((prev) => (prev ?? []).filter((t) => t.id !== taskId));
    } catch (err) {
      const msg =
        err instanceof TaskApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete";
      window.alert(`Couldn't delete task: ${msg}`);
    } finally {
      setDeletingId(null);
    }
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
          {rows.map((row) => {
            const task = (tasks ?? []).find((t) => t.id === row.id)!;
            const isEditing = editingId === row.id;
            const isDeleting = deletingId === row.id;
            if (isEditing) {
              return (
                <li key={row.id}>
                  <QuickCheckRow
                    unitId={unitId}
                    classId={classId}
                    framework={framework}
                    pages={pages}
                    editingTask={task}
                    onSaved={handleSaved}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              );
            }
            return (
              <li
                key={row.id}
                className="group px-2 py-1.5 bg-[var(--le-paper)] border border-[var(--le-hair)] rounded text-[11px] leading-tight"
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
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!row.isSummative && (
                      <button
                        type="button"
                        onClick={() => setEditingId(row.id)}
                        className="text-[10px] text-[var(--le-ink-3)] hover:text-violet-600 px-1"
                        title="Edit"
                        data-testid={`tasks-panel-edit-${row.id}`}
                      >
                        ✎
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id, row.title)}
                      disabled={isDeleting}
                      className="text-[10px] text-[var(--le-ink-3)] hover:text-rose-600 px-1 disabled:opacity-50"
                      title="Delete"
                      data-testid={`tasks-panel-delete-${row.id}`}
                    >
                      ✕
                    </button>
                  </div>
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
