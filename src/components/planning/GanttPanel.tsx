"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getPageColor } from "@/lib/constants";
import type { UnitPage } from "@/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GanttTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  pageId: string | null;
  startDate: string | null;
  targetDate: string | null;
}

interface GanttPanelProps {
  unitId: string;
  open: boolean;
  onClose: () => void;
  pageDueDates: Partial<Record<string, string>>;
  currentPageId?: string;
  pages: UnitPage[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function floorToMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? 6 : day - 1;
  r.setDate(r.getDate() - diff);
  return r;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (86400000));
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function GanttPanel({
  unitId,
  open,
  onClose,
  pageDueDates,
  currentPageId,
  pages,
}: GanttPanelProps) {
  function getTaskColor(pageId: string | null): string {
    if (!pageId) return "#FF3366";
    const page = pages.find((p) => p.id === pageId);
    return page ? getPageColor(page) : "#FF3366";
  }
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add-task form
  const [newTitle, setNewTitle] = useState("");
  const [newPage, setNewPage] = useState<string>("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [adding, setAdding] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  /* --- Data loading --- */
  const loadTasks = useCallback(async () => {
    setLoading(true);
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

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Auto-scroll to today
  useEffect(() => {
    if (open && !loading && todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }, 300);
    }
  }, [open, loading]);

  /* --- Timeline range --- */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allDates: Date[] = [today];
  for (const t of tasks) {
    if (t.startDate) allDates.push(toDate(t.startDate));
    if (t.targetDate) allDates.push(toDate(t.targetDate));
  }
  for (const d of Object.values(pageDueDates)) {
    if (d) allDates.push(toDate(d));
  }

  const minDate = floorToMonday(
    allDates.length > 0
      ? new Date(Math.min(...allDates.map((d) => d.getTime())))
      : addDays(today, -7)
  );
  const maxDateRaw = allDates.length > 0
    ? new Date(Math.max(...allDates.map((d) => d.getTime())))
    : addDays(today, 21);
  const maxDate = addDays(floorToMonday(maxDateRaw), 13); // extend to end of next week

  const totalDays = daysBetween(minDate, maxDate) + 1;

  // Week headers
  const weeks: Date[] = [];
  let w = new Date(minDate);
  while (w <= maxDate) {
    weeks.push(new Date(w));
    w = addDays(w, 7);
  }

  // Column index for a date
  function colFor(dateStr: string): number {
    return daysBetween(minDate, toDate(dateStr));
  }

  const todayCol = daysBetween(minDate, today);

  // Teacher milestones
  const milestones = Object.entries(pageDueDates)
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([pid, dateStr]) => {
      const page = pages.find((p) => p.id === pid);
      return {
        pageId: pid,
        dateStr,
        col: colFor(dateStr),
        color: page ? getPageColor(page) : "#999",
      };
    })
    .filter((m) => m.col >= 0 && m.col < totalDays);

  /* --- Actions --- */
  async function addTask() {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/student/planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          title: newTitle.trim(),
          pageId: newPage || null,
          startDate: newStart || null,
          targetDate: newEnd || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks((prev) => [...prev, data.task]);
        setNewTitle("");
        setNewPage("");
        setNewStart("");
        setNewEnd("");
      }
    } catch {
      // fail silently
    } finally {
      setAdding(false);
    }
  }

  async function updateTask(taskId: string, updates: Partial<{ startDate: string | null; targetDate: string | null; status: string }>) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              ...(updates.startDate !== undefined ? { startDate: updates.startDate } : {}),
              ...(updates.targetDate !== undefined ? { targetDate: updates.targetDate } : {}),
              ...(updates.status !== undefined ? { status: updates.status as GanttTask["status"] } : {}),
            }
          : t
      )
    );
    await fetch("/api/student/planning", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, ...updates }),
    });
  }

  async function deleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/student/planning?taskId=${taskId}`, { method: "DELETE" });
  }

  const DAY_WIDTH = 28;

  /* --- Render --- */
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-cta flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Schedule</h2>
              <p className="text-xs text-text-secondary">
                {loading ? "Loading..." : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-secondary hover:text-text-primary transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* B4 tip banner */}
        {currentPageId === "B4" && (
          <div className="mx-4 mt-3 px-3 py-2 bg-accent-green/10 border border-accent-green/20 rounded-lg">
            <p className="text-xs text-accent-green font-medium">
              Tip: Use this timeline to plan your project for Criterion B4
            </p>
          </div>
        )}

        {/* Content area */}
        {loading ? (
          <div className="flex-1 p-5">
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : tasks.length === 0 ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary/40">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="text-text-primary font-semibold mb-1">No tasks yet</p>
              <p className="text-text-secondary/60 text-sm">
                Plan your design journey — add tasks with dates to see your timeline.
              </p>
            </div>
          </div>
        ) : (
          /* Gantt chart */
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto" ref={scrollRef}>
              <div style={{ minWidth: `${200 + totalDays * DAY_WIDTH}px` }}>
                {/* Week header row */}
                <div className="flex sticky top-0 bg-white z-10 border-b border-border">
                  <div className="w-[200px] flex-shrink-0 px-3 py-2 text-xs font-semibold text-text-secondary border-r border-border">
                    Task
                  </div>
                  <div className="flex-1 relative" style={{ width: `${totalDays * DAY_WIDTH}px` }}>
                    <div className="flex">
                      {weeks.map((week, i) => (
                        <div
                          key={i}
                          className="text-[10px] font-medium text-text-secondary py-2 border-r border-border/50 text-center"
                          style={{ width: `${7 * DAY_WIDTH}px` }}
                        >
                          {week.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Task rows */}
                {tasks.map((task) => {
                  const color = getTaskColor(task.pageId);
                  const taskPageId = task.pageId;
                  const hasBar = task.startDate && task.targetDate;
                  const barStart = task.startDate ? colFor(task.startDate) : 0;
                  const barEnd = task.targetDate ? colFor(task.targetDate) : 0;
                  const barWidth = hasBar ? Math.max(barEnd - barStart + 1, 1) : 0;
                  const isDone = task.status === "done";
                  const isEditing = editingId === task.id;

                  return (
                    <div key={task.id}>
                      {/* Main row */}
                      <div className="flex group border-b border-border/40 hover:bg-surface-alt/50 transition">
                        {/* Task label */}
                        <div className="w-[200px] flex-shrink-0 px-3 py-2 flex items-center gap-2 border-r border-border/50">
                          {/* Status dot */}
                          <button
                            onClick={() => {
                              const next = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
                              updateTask(task.id, { status: next });
                            }}
                            className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition"
                            style={{
                              borderColor: isDone ? "#2DA05E" : color,
                              backgroundColor: isDone ? "#2DA05E" : task.status === "in_progress" ? color + "30" : "transparent",
                            }}
                            title={`Status: ${task.status}`}
                          >
                            {isDone && (
                              <svg width="8" height="8" viewBox="0 0 20 20" fill="white">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>

                          {/* Page badge */}
                          {taskPageId && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white flex-shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {taskPageId}
                            </span>
                          )}

                          <span className={`text-xs truncate flex-1 ${isDone ? "line-through text-text-secondary/50" : "text-text-primary"}`}>
                            {task.title}
                          </span>

                          {/* Edit / Delete */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => setEditingId(isEditing ? null : task.id)}
                              className="w-5 h-5 rounded hover:bg-gray-200 flex items-center justify-center text-text-secondary/40 hover:text-text-primary"
                              title="Edit dates"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center text-text-secondary/30 hover:text-red-400"
                              title="Delete"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Timeline bar area */}
                        <div className="flex-1 relative" style={{ width: `${totalDays * DAY_WIDTH}px`, height: "40px" }}>
                          {/* Weekend shading */}
                          {Array.from({ length: totalDays }).map((_, i) => {
                            const d = addDays(minDate, i);
                            const dow = d.getDay();
                            if (dow === 0 || dow === 6) {
                              return (
                                <div
                                  key={i}
                                  className="absolute top-0 bottom-0 bg-gray-50"
                                  style={{ left: `${i * DAY_WIDTH}px`, width: `${DAY_WIDTH}px` }}
                                />
                              );
                            }
                            return null;
                          })}

                          {/* Teacher milestones */}
                          {milestones.map((m) => (
                            <div
                              key={m.pageId}
                              className="absolute top-0 bottom-0 border-l border-dashed opacity-30"
                              style={{
                                left: `${m.col * DAY_WIDTH + DAY_WIDTH / 2}px`,
                                borderColor: m.color,
                              }}
                            />
                          ))}

                          {/* Today line */}
                          {todayCol >= 0 && todayCol < totalDays && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-brand-pink z-[2]"
                              style={{ left: `${todayCol * DAY_WIDTH + DAY_WIDTH / 2}px` }}
                            />
                          )}

                          {/* Task bar */}
                          {hasBar && barStart >= 0 && (
                            <div
                              className={`absolute top-2 h-6 rounded-full transition-opacity ${isDone ? "opacity-50" : ""}`}
                              style={{
                                left: `${barStart * DAY_WIDTH + 2}px`,
                                width: `${barWidth * DAY_WIDTH - 4}px`,
                                backgroundColor: color,
                              }}
                            >
                              {isDone && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <svg width="12" height="12" viewBox="0 0 20 20" fill="white" opacity="0.8">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          )}

                          {/* No dates indicator */}
                          {!hasBar && (
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-[9px] text-text-secondary/30 italic">No dates set</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Inline date editor */}
                      {isEditing && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt border-b border-border/40">
                          <label className="text-[10px] text-text-secondary font-medium">Start</label>
                          <input
                            type="date"
                            value={task.startDate || ""}
                            onChange={(e) => updateTask(task.id, { startDate: e.target.value || null })}
                            className="text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-pink/30"
                          />
                          <label className="text-[10px] text-text-secondary font-medium ml-2">End</label>
                          <input
                            type="date"
                            value={task.targetDate || ""}
                            onChange={(e) => updateTask(task.id, { targetDate: e.target.value || null })}
                            className="text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-pink/30"
                          />
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-[10px] text-brand-pink font-medium ml-auto"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Milestone labels row at bottom */}
                <div className="flex border-b border-border/40">
                  <div className="w-[200px] flex-shrink-0 border-r border-border/50" />
                  <div className="flex-1 relative h-6" style={{ width: `${totalDays * DAY_WIDTH}px` }}>
                    {milestones.map((m) => (
                      <div
                        key={`label-${m.pageId}`}
                        className="absolute top-0 flex flex-col items-center"
                        style={{ left: `${m.col * DAY_WIDTH + DAY_WIDTH / 2}px`, transform: "translateX(-50%)" }}
                      >
                        {/* Diamond */}
                        <div
                          className="w-2 h-2 rotate-45"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-[8px] font-bold mt-0.5 whitespace-nowrap" style={{ color: m.color }}>
                          {m.pageId}
                        </span>
                      </div>
                    ))}
                    {/* Today label */}
                    {todayCol >= 0 && todayCol < totalDays && (
                      <div
                        ref={todayRef}
                        className="absolute top-0 flex flex-col items-center"
                        style={{ left: `${todayCol * DAY_WIDTH + DAY_WIDTH / 2}px`, transform: "translateX(-50%)" }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-pink" />
                        <span className="text-[8px] font-bold text-brand-pink mt-0.5">Today</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add task row — fixed at bottom */}
        <div className="border-t border-border px-4 py-3 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New task..."
              className="flex-1 text-sm px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-pink/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
            />
            <select
              value={newPage}
              onChange={(e) => setNewPage(e.target.value)}
              className="text-xs px-2 py-2 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/30 bg-white w-20"
            >
              <option value="">Page</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="text-xs px-2 py-2 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/30 w-[120px]"
              title="Start date"
            />
            <input
              type="date"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="text-xs px-2 py-2 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/30 w-[120px]"
              title="End date"
            />
            <button
              onClick={addTask}
              disabled={!newTitle.trim() || adding}
              className="px-4 py-2 gradient-cta text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
            >
              {adding ? "..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
