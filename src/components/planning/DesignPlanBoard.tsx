"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * PlanTask: Core task interface for the design cycle board
 */
export interface PlanTask {
  id: string;
  title: string;
  status: "not_started" | "in_progress" | "done";
  phase: "backlog" | "A" | "B" | "C" | "D";
  dueDate?: string;
  timeEstimateMinutes?: number;
  sortOrder: number;
  createdAt: string;
}

/**
 * DesignPlanBoardProps: Component props
 */
interface DesignPlanBoardProps {
  tasks: PlanTask[];
  onTaskCreate: (task: Partial<PlanTask>) => void;
  onTaskUpdate: (taskId: string, updates: Partial<PlanTask>) => void;
  onTaskDelete: (taskId: string) => void;
  unitId: string;
}

/**
 * Column configuration with MYP Design Cycle phases
 */
interface ColumnConfig {
  phase: "backlog" | "A" | "B" | "C" | "D";
  label: string;
  criterion: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    phase: "backlog",
    label: "Backlog",
    criterion: "",
    color: "#6b7280",
    bgColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  {
    phase: "A",
    label: "Inquiring & Analysing",
    criterion: "A",
    color: "#6366f1",
    bgColor: "#e0e7ff",
    borderColor: "#6366f1",
  },
  {
    phase: "B",
    label: "Developing Ideas",
    criterion: "B",
    color: "#10b981",
    bgColor: "#d1fae5",
    borderColor: "#10b981",
  },
  {
    phase: "C",
    label: "Creating the Solution",
    criterion: "C",
    color: "#f59e0b",
    bgColor: "#fef3c7",
    borderColor: "#f59e0b",
  },
  {
    phase: "D",
    label: "Evaluating",
    criterion: "D",
    color: "#8b5cf6",
    bgColor: "#ede9fe",
    borderColor: "#8b5cf6",
  },
];

/**
 * Format time estimate to display string
 */
function formatTimeEstimate(minutes?: number): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format due date to display string
 */
function formatDueDate(dueDate?: string): string {
  if (!dueDate) return "";

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Get color class for due date badge
 */
function getDueDateColor(dueDate?: string): string {
  if (!dueDate) return "";

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "bg-red-100 text-red-700";
  if (diffDays <= 1) return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

/**
 * TaskCard: Individual task card with inline edit, status cycling, and metadata
 */
function TaskCard({
  task,
  columnConfig,
  onUpdate,
  onDelete,
}: {
  task: PlanTask;
  columnConfig: ColumnConfig;
  onUpdate: (updates: Partial<PlanTask>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      onUpdate({ title: editTitle.trim() });
    } else {
      setEditTitle(task.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setEditTitle(task.title);
      setIsEditing(false);
    }
  };

  const handleStatusClick = () => {
    const nextStatus =
      task.status === "not_started"
        ? "in_progress"
        : task.status === "in_progress"
          ? "done"
          : "not_started";
    onUpdate({ status: nextStatus });
  };

  return (
    <div
      className="group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
      style={{ borderLeft: `4px solid ${columnConfig.color}` }}
    >
      <div className="p-3 space-y-2">
        {/* Header: Drag handle + Title + Delete */}
        <div className="flex items-start gap-2">
          <button
            className="text-gray-300 hover:text-gray-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
            title="Drag to reorder"
          >
            {/* Grip icon */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" />
              <circle cx="15" cy="5" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="15" cy="19" r="1.5" />
            </svg>
          </button>

          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 text-left text-sm font-medium text-gray-900 hover:text-blue-700 transition"
              title="Click to edit"
            >
              {task.title}
            </button>
          )}

          <button
            onClick={onDelete}
            className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
            title="Delete task"
          >
            {/* X icon */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Metadata row: Status + Time + Due Date */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Status indicator */}
          <button
            onClick={handleStatusClick}
            className="flex-shrink-0 transition"
            title="Click to cycle status"
          >
            {task.status === "not_started" && (
              <div className="w-3 h-3 rounded-full border-2 border-gray-300 hover:border-gray-500" />
            )}
            {task.status === "in_progress" && (
              <div
                className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"
                style={{
                  boxShadow: `0 0 0 2px ${columnConfig.color}40`,
                }}
              />
            )}
            {task.status === "done" && (
              <div className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center text-white">
                <span className="text-xs leading-none">✓</span>
              </div>
            )}
          </button>

          {/* Time estimate */}
          {task.timeEstimateMinutes && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-gray-700 rounded">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {formatTimeEstimate(task.timeEstimateMinutes)}
            </span>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span
              className={`inline-flex px-2 py-1 rounded font-medium ${getDueDateColor(task.dueDate)}`}
            >
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Column: Kanban column for a single phase
 */
function Column({
  config,
  tasks,
  onTaskCreate,
  onTaskUpdate,
  onTaskDelete,
}: {
  config: ColumnConfig;
  tasks: PlanTask[];
  onTaskCreate: (task: Partial<PlanTask>) => void;
  onTaskUpdate: (taskId: string, updates: Partial<PlanTask>) => void;
  onTaskDelete: (taskId: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleCreateTask = () => {
    if (!newTitle.trim()) return;

    onTaskCreate({
      title: newTitle.trim(),
      phase: config.phase,
      status: "not_started",
      sortOrder: tasks.length,
    });

    setNewTitle("");
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateTask();
    } else if (e.key === "Escape") {
      setNewTitle("");
      setIsAdding(false);
    }
  };

  return (
    <div
      className="flex flex-col rounded-2xl border shadow-sm overflow-hidden flex-1 min-w-0"
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: config.borderColor }}
      >
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="font-semibold text-sm" style={{ color: config.color }}>
              {config.label}
            </span>
            {config.criterion && (
              <span className="text-xs" style={{ color: config.color }}>
                Criterion {config.criterion}
              </span>
            )}
          </div>
          <span
            className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: config.color,
              color: "white",
            }}
          >
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="p-1 rounded hover:opacity-70 transition"
          style={{ color: config.color }}
          title="Add task"
        >
          {/* Plus icon */}
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {isAdding && (
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleCreateTask}
            onKeyDown={handleKeyDown}
            placeholder="Task name..."
            className="w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none"
            style={{
              borderColor: config.color,
              backgroundColor: "white",
            }}
          />
        )}

        {tasks.length === 0 && !isAdding && (
          <div className="text-center py-8 text-gray-500 text-xs">
            No tasks yet —<br />
            press + to add
          </div>
        )}

        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            columnConfig={config}
            onUpdate={(updates) => onTaskUpdate(task.id, updates)}
            onDelete={() => onTaskDelete(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * DesignPlanBoard: Main kanban board component with MYP Design Cycle phases
 */
export function DesignPlanBoard({
  tasks,
  onTaskCreate,
  onTaskUpdate,
  onTaskDelete,
  unitId,
}: DesignPlanBoardProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // "N" to add task (would need focus context, skip for now)
      // "E" to edit selected task (would need selection state, skip for now)
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full bg-white rounded-2xl border border-gray-200 shadow-sm p-4 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Design Plan</h2>
        <p className="text-sm text-gray-600 mt-1">
          Organize your work across the design cycle phases
        </p>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto gap-4 flex min-w-0">
        {COLUMNS.map((config) => {
          const columnTasks = tasks
            .filter((t) => t.phase === config.phase)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          return (
            <Column
              key={config.phase}
              config={config}
              tasks={columnTasks}
              onTaskCreate={onTaskCreate}
              onTaskUpdate={onTaskUpdate}
              onTaskDelete={onTaskDelete}
            />
          );
        })}
      </div>
    </div>
  );
}
