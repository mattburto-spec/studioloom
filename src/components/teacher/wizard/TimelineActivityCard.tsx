"use client";

import { useState, useRef, useCallback } from "react";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import type { TimelineActivity } from "@/types";
import type { WizardDispatch } from "@/hooks/useWizardState";

interface Props {
  activity: TimelineActivity;
  index: number;
  totalCount: number;
  dispatch: WizardDispatch;
  isBeingDragged?: boolean;
  isRegenerating?: boolean;
  onDragStart?: () => void;
  onRegenerateActivity?: (activityId: string) => void;
}

const ROLE_ICONS: Record<string, string> = {
  warmup: "\u2600\uFE0F",   // ☀️
  intro: "\uD83D\uDCA1",    // 💡
  core: "\uD83C\uDFAF",     // 🎯
  content: "\u2139\uFE0F",  // ℹ️
  reflection: "\uD83E\uDE9E", // 🪞
};

const ROLE_LABELS: Record<string, string> = {
  warmup: "Warm-up",
  intro: "Intro",
  core: "Core",
  content: "Content",
  reflection: "Reflection",
};

const ROLE_ACCENT_COLORS: Record<string, string> = {
  warmup: "#fbbf24",
  intro: "#60a5fa",
  core: "#7B2FF2",
  content: "#6B7280",
  reflection: "#8b5cf6",
};

const RESPONSE_TYPE_LABELS: Record<string, string> = {
  text: "Written",
  upload: "Upload",
  voice: "Voice",
  link: "Link",
  multi: "Multi",
  "decision-matrix": "Matrix",
  pmi: "PMI",
  pairwise: "Pairwise",
  "trade-off-sliders": "Sliders",
};

const MIN_MINUTES = 5;

// Clock icon with drag handle for time adjustment
function DraggableTime({
  minutes,
  onAdjust,
}: {
  minutes: number;
  onAdjust: (delta: number) => void;
}) {
  const dragStartY = useRef<number | null>(null);
  const accumulatedDelta = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragStartY.current = e.clientY;
    accumulatedDelta.current = 0;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const diff = dragStartY.current - e.clientY;
    const stepPx = 12;
    const steps = Math.round(diff / stepPx);
    const newDelta = steps * 5;
    if (newDelta !== accumulatedDelta.current) {
      onAdjust(newDelta - accumulatedDelta.current);
      accumulatedDelta.current = newDelta;
    }
  }, [onAdjust]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragStartY.current = null;
    accumulatedDelta.current = 0;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <span
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded flex items-center gap-0.5 select-none touch-none transition-all ${
        isDragging
          ? "ring-2 ring-brand-purple/30 bg-brand-purple/10 text-brand-purple font-semibold scale-110"
          : "text-text-tertiary hover:bg-gray-100 cursor-ns-resize"
      }`}
      title="Drag up/down to adjust time"
    >
      {minutes}m
    </span>
  );
}

export function TimelineActivityCard({
  activity,
  index,
  totalCount,
  dispatch,
  isBeingDragged = false,
  isRegenerating = false,
  onDragStart,
  onRegenerateActivity,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const icon = ROLE_ICONS[activity.role] || ROLE_ICONS.core;
  const accentColor = ROLE_ACCENT_COLORS[activity.role] || ROLE_ACCENT_COLORS.core;
  const showPromptPreview = activity.durationMinutes >= 15 && !isExpanded;

  const handleTimeAdjust = useCallback((delta: number) => {
    const newVal = Math.max(MIN_MINUTES, activity.durationMinutes + delta);
    dispatch({
      type: "UPDATE_ACTIVITY",
      activityId: activity.id,
      updates: { durationMinutes: newVal },
    });
  }, [activity.id, activity.durationMinutes, dispatch]);

  const handleDelete = useCallback(() => {
    if (window.confirm("Delete this activity?")) {
      dispatch({ type: "DELETE_ACTIVITY", activityId: activity.id });
    }
  }, [activity.id, dispatch]);

  const handleDragPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    onDragStart?.();
  }, [onDragStart]);

  // --- Collapsed: Notion-style flat block ---
  if (!isExpanded) {
    return (
      <div
        className={`timeline-block ${isBeingDragged ? "timeline-block-dragging" : ""} ${
          isRegenerating ? "animate-pulse" : ""
        }`}
      >
        {/* Left accent line */}
        <div
          className="timeline-block-accent"
          style={{ backgroundColor: accentColor }}
        />

        {/* Main row */}
        <div className="flex items-start gap-1.5 px-2 py-1.5">
          {/* Drag handle — hidden, revealed on hover */}
          <div
            onPointerDown={handleDragPointerDown}
            className="block-handle flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/5 touch-none select-none mt-0.5"
            title="Drag to reorder"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="text-text-tertiary/50">
              <circle cx="3" cy="2" r="1.2" />
              <circle cx="7" cy="2" r="1.2" />
              <circle cx="3" cy="7" r="1.2" />
              <circle cx="7" cy="7" r="1.2" />
              <circle cx="3" cy="12" r="1.2" />
              <circle cx="7" cy="12" r="1.2" />
            </svg>
          </div>

          {/* Role icon */}
          <span className="text-sm flex-shrink-0 mt-px select-none">{icon}</span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsExpanded(true)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="text-[13px] text-text-primary leading-snug line-clamp-1">
                  {activity.title}
                </span>
              </button>

              {/* Criterion tags */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {activity.criterionTags?.map((tag) => {
                  const criterion = CRITERIA[tag as CriterionKey];
                  return (
                    <span
                      key={tag}
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
                      style={{ backgroundColor: criterion?.color || "#888" }}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>

              {/* Duration */}
              <DraggableTime minutes={activity.durationMinutes} onAdjust={handleTimeAdjust} />
            </div>

            {/* Prompt preview for longer activities */}
            {showPromptPreview && (
              <p className="text-[11px] text-text-tertiary leading-snug mt-0.5 line-clamp-1">
                {activity.prompt}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Expanded: edit mode ---
  return (
    <div
      className={`timeline-block expanded ${isRegenerating ? "animate-pulse" : ""}`}
    >
      {/* Left accent line — always visible when expanded */}
      <div
        className="timeline-block-accent"
        style={{ backgroundColor: accentColor, opacity: 1 }}
      />

      <div className="px-2 py-2 space-y-2">
        {/* Header row */}
        <div className="flex items-start gap-1.5">
          {/* Drag handle */}
          <div
            onPointerDown={handleDragPointerDown}
            className="block-handle flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/5 touch-none select-none mt-0.5"
            style={{ opacity: 1 }}
            title="Drag to reorder"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="text-text-tertiary/50">
              <circle cx="3" cy="2" r="1.2" />
              <circle cx="7" cy="2" r="1.2" />
              <circle cx="3" cy="7" r="1.2" />
              <circle cx="7" cy="7" r="1.2" />
              <circle cx="3" cy="12" r="1.2" />
              <circle cx="7" cy="12" r="1.2" />
            </svg>
          </div>

          {/* Role icon */}
          <span className="text-sm flex-shrink-0 mt-px select-none">{icon}</span>

          {/* Title — editable */}
          <div className="flex-1 min-w-0">
            {editingField === "title" ? (
              <input
                type="text"
                value={activity.title}
                onChange={(e) =>
                  dispatch({ type: "UPDATE_ACTIVITY", activityId: activity.id, updates: { title: e.target.value } })
                }
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
                autoFocus
                className="w-full px-1.5 py-0.5 border border-brand-purple/30 rounded text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-brand-purple/20"
              />
            ) : (
              <span
                className="text-[13px] font-medium text-text-primary cursor-pointer hover:text-brand-purple inline-block leading-snug"
                onClick={() => setEditingField("title")}
              >
                {activity.title}
              </span>
            )}
          </div>

          {/* Duration + collapse button */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <DraggableTime minutes={activity.durationMinutes} onAdjust={handleTimeAdjust} />
            <button onClick={() => setIsExpanded(false)} className="p-0.5 rounded hover:bg-gray-100">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary rotate-180">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-1.5 flex-wrap ml-7">
          <span className="text-[9px] text-text-tertiary uppercase tracking-wider font-medium">
            {ROLE_LABELS[activity.role] || "Core"}
          </span>
          <span className="text-text-tertiary/30">·</span>
          <span className="text-[9px] text-text-tertiary">
            {activity.responseType ? (RESPONSE_TYPE_LABELS[activity.responseType] || activity.responseType) : "Content"}
          </span>
          {activity.portfolioCapture && (
            <>
              <span className="text-text-tertiary/30">·</span>
              <span className="text-[9px] text-accent-green font-medium">Portfolio</span>
            </>
          )}
          {activity.phaseLabel && (
            <>
              <span className="text-text-tertiary/30">·</span>
              <span className="text-[9px] text-brand-purple/60">{activity.phaseLabel}</span>
            </>
          )}
          {activity.criterionTags?.map((tag) => {
            const criterion = CRITERIA[tag as CriterionKey];
            return (
              <span
                key={tag}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
                style={{ backgroundColor: criterion?.color || "#888" }}
              >
                {tag}
              </span>
            );
          })}
        </div>

        {/* Prompt — editable */}
        <div className="ml-7">
          {editingField === "prompt" ? (
            <textarea
              value={activity.prompt}
              onChange={(e) =>
                dispatch({ type: "UPDATE_ACTIVITY", activityId: activity.id, updates: { prompt: e.target.value } })
              }
              onBlur={() => setEditingField(null)}
              autoFocus
              rows={3}
              className="w-full px-2 py-1.5 border border-brand-purple/30 rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-brand-purple/20 resize-none leading-relaxed"
            />
          ) : (
            <p
              className="text-[12px] text-text-secondary leading-relaxed cursor-pointer hover:bg-black/[0.02] rounded px-1 py-0.5 -mx-1"
              onClick={() => setEditingField("prompt")}
            >
              {activity.prompt}
            </p>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-1 ml-7 pt-1">
          {index > 0 && (
            <button
              onClick={() => dispatch({ type: "REORDER_ACTIVITY", fromIndex: index, toIndex: index - 1 })}
              className="text-[10px] text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-gray-100"
              title="Move up"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6" /></svg>
            </button>
          )}
          {index < totalCount - 1 && (
            <button
              onClick={() => dispatch({ type: "REORDER_ACTIVITY", fromIndex: index, toIndex: index + 1 })}
              className="text-[10px] text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-gray-100"
              title="Move down"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          )}
          <div className="flex-1" />
          {onRegenerateActivity && (
            <button
              onClick={() => onRegenerateActivity(activity.id)}
              disabled={isRegenerating}
              className="text-[10px] text-text-tertiary hover:text-brand-purple p-1 rounded hover:bg-brand-purple/5 disabled:opacity-50 flex items-center gap-0.5"
              title="Regenerate this activity"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span className="hidden sm:inline">Regenerate</span>
            </button>
          )}
          <button
            onClick={handleDelete}
            className="text-[10px] text-text-tertiary hover:text-red-500 p-1 rounded hover:bg-red-50 flex items-center gap-0.5"
            title="Delete activity"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
