"use client";

import { useState, useEffect, useCallback } from "react";
import { getPageColor } from "@/lib/constants";
import type { UnitPage } from "@/types";

interface Task {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  pageId: string | null;
  pageNumber: number | null;
  startDate: string | null;
  targetDate: string | null;
  timeLogged: number;
}

interface PlanningPanelProps {
  unitId: string;
  open: boolean;
  onClose: () => void;
  pages: UnitPage[];
}

export function PlanningPanel({ unitId, open, onClose, pages }: PlanningPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPage, setNewTaskPage] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/planning?unitId=${unitId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    if (open) loadTasks();
  }, [open, loadTasks]);

  async function addTask() {
    if (!newTaskTitle.trim()) return;

    const res = await fetch("/api/student/planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId,
        title: newTaskTitle.trim(),
        pageId: newTaskPage,
      }),
    });

    if (res.ok) {
      setNewTaskTitle("");
      setNewTaskPage(null);
      loadTasks();
    }
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await fetch("/api/student/planning", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    });
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: status as Task["status"] } : t))
    );
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/student/planning?taskId=${taskId}`, {
      method: "DELETE",
    });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleDragStart(taskId: string) {
    setDraggedTask(taskId);
  }

  function handleDrop(status: Task["status"]) {
    if (draggedTask) {
      updateTaskStatus(draggedTask, status);
      setDraggedTask(null);
    }
  }

  const columns: { status: Task["status"]; label: string; color: string }[] = [
    { status: "todo", label: "To Do", color: "border-gray-300" },
    { status: "in_progress", label: "In Progress", color: "border-amber-400" },
    { status: "done", label: "Done", color: "border-accent-green" },
  ];

  function getPageLabel(task: Task) {
    const pid = task.pageId;
    if (!pid) return null;
    const page = pages.find((p) => p.id === pid);
    if (!page) return null;
    return { id: page.id, color: getPageColor(page) };
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">My Plan</h2>
            <p className="text-xs text-text-secondary">
              {tasks.filter((t) => t.status === "done").length}/{tasks.length}{" "}
              tasks done
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-surface-alt rounded-lg p-0.5">
              <button
                onClick={() => setView("kanban")}
                className={`px-2 py-1 text-xs rounded transition ${
                  view === "kanban"
                    ? "bg-white shadow-sm text-text-primary"
                    : "text-text-secondary"
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-2 py-1 text-xs rounded transition ${
                  view === "list"
                    ? "bg-white shadow-sm text-text-primary"
                    : "text-text-secondary"
                }`}
              >
                List
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Add task */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex gap-2">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task..."
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
            />
            <select
              value={newTaskPage || ""}
              onChange={(e) =>
                setNewTaskPage(e.target.value || null)
              }
              className="px-2 py-2 text-xs border border-border rounded-lg bg-white"
            >
              <option value="">Page</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </select>
            <button
              onClick={addTask}
              disabled={!newTaskTitle.trim()}
              className="px-3 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-gray-100 rounded" />
              <div className="h-32 bg-gray-100 rounded" />
            </div>
          ) : view === "kanban" ? (
            /* Kanban view */
            <div className="grid grid-cols-3 gap-3 h-full">
              {columns.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.status);
                return (
                  <div
                    key={col.status}
                    className={`rounded-lg border-t-2 ${col.color} bg-surface-alt/50 p-2 flex flex-col`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(col.status)}
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        {col.label}
                      </span>
                      <span className="text-xs text-text-secondary/60 bg-white rounded-full w-5 h-5 flex items-center justify-center">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="space-y-2 flex-1">
                      {colTasks.map((task) => {
                        const pageLabel = getPageLabel(task);
                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => handleDragStart(task.id)}
                            className="bg-white rounded-lg p-2.5 shadow-sm border border-border/50 cursor-grab active:cursor-grabbing hover:shadow-md transition group"
                          >
                            <div className="flex items-start gap-2">
                              <p className="text-sm text-text-primary flex-1 leading-snug">
                                {task.title}
                              </p>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="text-xs text-text-secondary/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                              >
                                ✕
                              </button>
                            </div>
                            {pageLabel && (
                              <span
                                className="mt-1.5 inline-block text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: pageLabel.color + "15",
                                  color: pageLabel.color,
                                }}
                              >
                                {pageLabel.id}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view */
            <div className="space-y-1">
              {tasks.length === 0 ? (
                <p className="text-text-secondary text-sm text-center py-8">
                  No tasks yet. Add one above to get started.
                </p>
              ) : (
                tasks.map((task) => {
                  const pageLabel = getPageLabel(task);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-alt transition group"
                    >
                      <button
                        onClick={() => {
                          const nextStatus =
                            task.status === "todo"
                              ? "in_progress"
                              : task.status === "in_progress"
                              ? "done"
                              : "todo";
                          updateTaskStatus(task.id, nextStatus);
                        }}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                          task.status === "done"
                            ? "border-accent-green bg-accent-green text-white"
                            : task.status === "in_progress"
                            ? "border-amber-400 bg-amber-50"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {task.status === "done" && (
                          <span className="text-xs">✓</span>
                        )}
                        {task.status === "in_progress" && (
                          <span className="text-xs text-amber-500">●</span>
                        )}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          task.status === "done"
                            ? "line-through text-text-secondary"
                            : "text-text-primary"
                        }`}
                      >
                        {task.title}
                      </span>
                      {pageLabel && (
                        <span
                          className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: pageLabel.color + "15",
                            color: pageLabel.color,
                          }}
                        >
                          {pageLabel.id}
                        </span>
                      )}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-xs text-text-secondary/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
