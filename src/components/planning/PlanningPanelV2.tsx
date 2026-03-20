"use client";

import { useState, useEffect, useCallback } from "react";
import { DesignPlanBoard, type PlanTask } from "./DesignPlanBoard";
import type { UnitPage } from "@/types";

interface PlanningPanelV2Props {
  unitId: string;
  open: boolean;
  onClose: () => void;
  pages: UnitPage[];
}

/**
 * Slide-out planning panel that wraps the new DesignPlanBoard.
 * Manages task CRUD via the existing /api/student/planning API.
 * Drop-in replacement for PlanningPanel.
 */
export function PlanningPanelV2({ unitId, open, onClose, pages }: PlanningPanelV2Props) {
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/planning?unitId=${unitId}`);
      if (res.ok) {
        const data = await res.json();
        // Map API tasks to PlanTask format
        const mapped: PlanTask[] = (data.tasks || []).map((t: {
          id: string;
          title: string;
          status: string;
          page_id?: string;
          target_date?: string;
          time_logged?: number;
          sort_order?: number;
          created_at: string;
        }) => ({
          id: t.id,
          title: t.title,
          status: t.status === "done" ? "done" : t.status === "in_progress" ? "in_progress" : "not_started",
          phase: mapPageToPhase(t.page_id),
          dueDate: t.target_date || undefined,
          timeEstimateMinutes: t.time_logged || undefined,
          sortOrder: t.sort_order || 0,
          createdAt: t.created_at,
        }));
        setTasks(mapped);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [unitId]);

  useEffect(() => {
    if (open) loadTasks();
  }, [open, loadTasks]);

  // Map page_id to design cycle phase
  function mapPageToPhase(pageId?: string): PlanTask["phase"] {
    if (!pageId) return "backlog";
    const criterion = pageId.match(/^([A-D])/)?.[1];
    if (criterion === "A" || criterion === "B" || criterion === "C" || criterion === "D") {
      return criterion;
    }
    return "backlog";
  }

  // Map phase back to a page_id for the API
  function phaseToPageId(phase: PlanTask["phase"]): string | null {
    if (phase === "backlog") return null;
    // Find first page matching this criterion
    const page = pages.find(p => p.criterion === phase);
    return page?.id || `${phase}1`;
  }

  const handleCreate = async (task: Partial<PlanTask>) => {
    try {
      const res = await fetch("/api/student/planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          title: task.title || "New task",
          status: task.status === "in_progress" ? "in_progress" : task.status === "done" ? "done" : "todo",
          pageId: phaseToPageId(task.phase || "backlog"),
        }),
      });
      if (res.ok) loadTasks();
    } catch { /* silent */ }
  };

  const handleUpdate = async (taskId: string, updates: Partial<PlanTask>) => {
    try {
      const body: Record<string, unknown> = {};
      if (updates.title !== undefined) body.title = updates.title;
      if (updates.status !== undefined) {
        body.status = updates.status === "not_started" ? "todo" : updates.status;
      }
      if (updates.phase !== undefined) {
        body.pageId = phaseToPageId(updates.phase);
      }
      if (updates.dueDate !== undefined) body.targetDate = updates.dueDate;

      await fetch("/api/student/planning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, ...body }),
      });
      loadTasks();
    } catch { /* silent */ }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await fetch("/api/student/planning", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      loadTasks();
    } catch { /* silent */ }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        style={{ backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="absolute right-0 top-0 h-full bg-white shadow-2xl overflow-y-auto"
        style={{ width: "min(90vw, 900px)" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">My Design Plan</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Organise tasks by MYP Design Cycle phase
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-secondary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DesignPlanBoard
              tasks={tasks}
              onTaskCreate={handleCreate}
              onTaskUpdate={handleUpdate}
              onTaskDelete={handleDelete}
              unitId={unitId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
