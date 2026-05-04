"use client";

import { useState, useCallback } from "react";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import type { TimelineActivity } from "@/types";
import type { WizardDispatch } from "@/hooks/useWizardState";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";

const ROLE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  warmup:     { icon: "☀️", label: "Warm-up",    color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  intro:      { icon: "💡", label: "Intro",       color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  core:       { icon: "🎯", label: "Core",        color: "#7B2FF2", bg: "rgba(123,47,242,0.08)" },
  reflection: { icon: "🪞", label: "Reflection",  color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
};

const RESPONSE_TYPE_LABELS: Record<string, string> = {
  text: "Written", upload: "Upload", voice: "Voice", link: "Link",
  multi: "Multi", "decision-matrix": "Matrix", pmi: "PMI",
  pairwise: "Pairwise", "trade-off-sliders": "Sliders",
};

const MIN_MINUTES = 5;
const MAX_MINUTES = 60;

interface Props {
  activity: TimelineActivity;
  index: number;
  totalCount: number;
  dispatch: WizardDispatch;
  isBeingDragged?: boolean;
  isRegenerating?: boolean;
  /** Position in the fan layout (0-based) */
  fanIndex?: number;
  /** Total cards in this fan */
  fanTotal?: number;
  /** Whether this card is in the fan (expanded) view */
  isFanned?: boolean;
  onDragStart?: () => void;
  onRegenerateActivity?: (activityId: string) => void;
}

/**
 * DeckActivityCard — playing-card style activity card.
 *
 * In the fan view: card has a slight rotation based on position,
 * shows role color band at top, title, duration slider at bottom,
 * and criterion pips.
 *
 * Click to flip → shows full prompt and edit controls on the back.
 */
export function DeckActivityCard({
  activity,
  index,
  totalCount,
  dispatch,
  isBeingDragged = false,
  isRegenerating = false,
  fanIndex = 0,
  fanTotal = 1,
  isFanned = false,
  onDragStart,
  onRegenerateActivity,
}: Props) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  const role = ROLE_CONFIG[activity.role] || ROLE_CONFIG.core;

  // Fan positioning: slight spread and rotation
  const fanRotation = isFanned
    ? (fanIndex - (fanTotal - 1) / 2) * 2.5 // ±degrees from center
    : 0;
  const fanTranslateX = isFanned
    ? (fanIndex - (fanTotal - 1) / 2) * 8 // slight horizontal spread
    : 0;

  // Horizontal duration slider
  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseInt(e.target.value, 10);
    if (!isNaN(newVal) && newVal >= MIN_MINUTES) {
      dispatch({
        type: "UPDATE_ACTIVITY",
        activityId: activity.id,
        updates: { durationMinutes: newVal },
      });
    }
  }, [activity.id, dispatch]);

  const handleDelete = useCallback(() => {
    if (window.confirm("Remove this card from the deck?")) {
      dispatch({ type: "DELETE_ACTIVITY", activityId: activity.id });
    }
  }, [activity.id, dispatch]);

  const handleDragPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    onDragStart?.();
  }, [onDragStart]);

  // Card dimensions scale slightly with duration
  const cardHeight = Math.max(180, Math.min(240, 160 + activity.durationMinutes * 1.2));

  return (
    <div
      className={`deck-card-container group ${isFlipped ? "flipped" : ""}`}
      style={{
        zIndex: isBeingDragged ? 50 : isFlipped ? 40 : fanIndex,
        height: cardHeight,
      }}
    >
      <div
        className={`deck-card ${isBeingDragged ? "deck-card-dragging" : ""} ${
          isRegenerating ? "animate-pulse" : ""
        }`}
      >
        {/* ===== FRONT FACE ===== */}
        <div className="deck-card-face deck-card-front" onClick={() => setIsFlipped(true)}>
          {/* Top role band */}
          <div
            className="h-1.5 rounded-t-xl"
            style={{ backgroundColor: role.color }}
          />

          {/* Drag handle — top right */}
          <div
            onPointerDown={handleDragPointerDown}
            className="absolute top-3 right-2 cursor-grab active:cursor-grabbing p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/5 touch-none select-none transition-opacity z-10"
            title="Drag to reorder"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="text-text-tertiary/40">
              <circle cx="3" cy="2" r="1.2" />
              <circle cx="7" cy="2" r="1.2" />
              <circle cx="3" cy="7" r="1.2" />
              <circle cx="7" cy="7" r="1.2" />
              <circle cx="3" cy="12" r="1.2" />
              <circle cx="7" cy="12" r="1.2" />
            </svg>
          </div>

          {/* Card body */}
          <div className="px-3 pt-2 pb-1 flex flex-col flex-1 min-h-0">
            {/* Role badge */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm select-none">{role.icon}</span>
              <span
                className="text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: role.color }}
              >
                {role.label}
              </span>
            </div>

            {/* Title */}
            <h4 className="text-[13px] font-semibold text-text-primary leading-snug line-clamp-2 mb-1">
              {activity.title}
            </h4>

            {/* Prompt preview — Lever 1 composed text */}
            <p className="text-[11px] text-text-tertiary leading-snug line-clamp-2 flex-1 min-h-0">
              {composedPromptText(activity)}
            </p>

            {/* Bottom: criterion pips + response type */}
            <div className="flex items-center gap-1.5 mt-auto pt-1.5">
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
              <span className="text-[9px] text-text-tertiary ml-auto">
                {activity.responseType ? (RESPONSE_TYPE_LABELS[activity.responseType] || activity.responseType) : "Content"}
              </span>
              {activity.portfolioCapture && (
                <span className="text-[9px] text-accent-green font-medium">📂</span>
              )}
            </div>
          </div>

          {/* Horizontal duration slider at bottom */}
          <div
            className="px-3 py-1.5 rounded-b-xl bg-gray-50"
            style={{ borderTop: `2px solid ${role.color}20` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <input
                type="range"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                step={5}
                value={activity.durationMinutes}
                onChange={handleDurationChange}
                className="deck-duration-slider flex-1 h-1 cursor-pointer"
                style={{
                  accentColor: role.color,
                }}
              />
              <span className="text-[10px] font-semibold tabular-nums text-text-secondary w-7 text-right flex-shrink-0">
                {activity.durationMinutes}m
              </span>
            </div>
          </div>
        </div>

        {/* ===== BACK FACE ===== */}
        <div className="deck-card-face deck-card-back">
          {/* Top role band */}
          <div
            className="h-1.5 rounded-t-xl"
            style={{ backgroundColor: role.color }}
          />

          <div className="px-3 pt-2 pb-2 flex flex-col flex-1 min-h-0 overflow-y-auto">
            {/* Back header */}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm select-none">{role.icon}</span>
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                Edit Card
              </span>
              <div className="flex-1" />
              <button
                onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
                className="p-1 rounded hover:bg-gray-100 text-text-tertiary"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Title — editable */}
            <label className="text-[9px] text-text-tertiary uppercase tracking-wider font-medium mb-0.5">Title</label>
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
                className="w-full px-1.5 py-1 border border-brand-purple/30 rounded text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-brand-purple/20 mb-2"
              />
            ) : (
              <p
                className="text-[12px] font-medium text-text-primary cursor-pointer hover:bg-black/[0.03] rounded px-1 py-0.5 -mx-1 mb-2"
                onClick={(e) => { e.stopPropagation(); setEditingField("title"); }}
              >
                {activity.title}
              </p>
            )}

            {/* Prompt — editable */}
            <label className="text-[9px] text-text-tertiary uppercase tracking-wider font-medium mb-0.5">Activity Prompt</label>
            {editingField === "prompt" ? (
              <textarea
                value={activity.prompt}
                onChange={(e) =>
                  dispatch({ type: "UPDATE_ACTIVITY", activityId: activity.id, updates: { prompt: e.target.value } })
                }
                onBlur={() => setEditingField(null)}
                autoFocus
                rows={3}
                className="w-full px-1.5 py-1 border border-brand-purple/30 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-purple/20 resize-none leading-relaxed flex-1 min-h-0 mb-2"
              />
            ) : (
              <p
                className="text-[11px] text-text-secondary leading-relaxed cursor-pointer hover:bg-black/[0.03] rounded px-1 py-0.5 -mx-1 flex-1 min-h-0 mb-2"
                onClick={(e) => { e.stopPropagation(); setEditingField("prompt"); }}
              >
                {/* Lever 1: render composed text; legacy textarea still edits `prompt` */}
                {composedPromptText(activity)}
              </p>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-1 flex-wrap text-[9px] text-text-tertiary mb-2">
              <span>{activity.responseType ? (RESPONSE_TYPE_LABELS[activity.responseType] || activity.responseType) : "Content"}</span>
              {activity.phaseLabel && (
                <>
                  <span className="text-text-tertiary/30">·</span>
                  <span className="text-brand-purple/60">{activity.phaseLabel}</span>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 mt-auto pt-1 border-t border-gray-100">
              {index > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "REORDER_ACTIVITY", fromIndex: index, toIndex: index - 1 }); }}
                  className="text-[10px] text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-gray-100"
                  title="Move up"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6" /></svg>
                </button>
              )}
              {index < totalCount - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "REORDER_ACTIVITY", fromIndex: index, toIndex: index + 1 }); }}
                  className="text-[10px] text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-gray-100"
                  title="Move down"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              )}
              <div className="flex-1" />
              {onRegenerateActivity && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRegenerateActivity(activity.id); }}
                  disabled={isRegenerating}
                  className="text-[10px] text-text-tertiary hover:text-brand-purple p-1 rounded hover:bg-brand-purple/5 disabled:opacity-50"
                  title="Regenerate"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="text-[10px] text-text-tertiary hover:text-red-500 p-1 rounded hover:bg-red-50"
                title="Remove"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
