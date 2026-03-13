"use client";

import { useCallback } from "react";
import type { ComputedLesson, TimelineActivity } from "@/types";
import type { WizardDispatch } from "@/hooks/useWizardState";
import { DeckActivityCard } from "./DeckActivityCard";

const ROLE_COLORS: Record<string, string> = {
  warmup: "#f59e0b",
  intro: "#3b82f6",
  core: "#7B2FF2",
  reflection: "#8b5cf6",
};

interface Props {
  lesson: ComputedLesson;
  activities: TimelineActivity[];
  lessonLength: number;
  isSelected: boolean;
  onSelect: () => void;
  dispatch: WizardDispatch;
  totalActivityCount: number;
  globalIndexOffset: number;
  draggedActivityId: string | null;
  regeneratingActivityId: string | null;
  phaseLabel?: string;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onDragStart: (activityId: string) => void;
  onInsertActivity: (afterGlobalIndex: number) => void;
  onRegenerateActivity?: (activityId: string) => void;
}

/**
 * DeckLessonStack — fan view for a selected lesson.
 *
 * Renders activity cards in a responsive grid with dealing animation.
 * Header shows lesson info + duration bar. "Add Card" button at the end.
 * This component is ONLY rendered in the right panel when a lesson is selected.
 */
export function DeckLessonStack({
  lesson,
  activities,
  lessonLength,
  isSelected,
  onSelect,
  dispatch,
  totalActivityCount,
  globalIndexOffset,
  draggedActivityId,
  regeneratingActivityId,
  phaseLabel,
  cardRefs,
  onDragStart,
  onInsertActivity,
  onRegenerateActivity,
}: Props) {
  const isOver = lesson.totalMinutes > lessonLength;

  const handleAddCard = useCallback(() => {
    onInsertActivity(globalIndexOffset + activities.length - 1);
  }, [onInsertActivity, globalIndexOffset, activities.length]);

  return (
    <div className="deck-fan-container">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onSelect}
          className="flex items-center gap-1.5 text-brand-purple hover:text-brand-purple/80 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-[11px] font-semibold">Back</span>
        </button>
        <span className={`text-[15px] font-bold ${isOver ? "text-red-500" : "text-text-primary"}`}>
          Lesson {lesson.lessonNumber}
        </span>
        {phaseLabel && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-purple/5 text-brand-purple/60 font-medium">
            {phaseLabel}
          </span>
        )}
        <div className="flex-1" />
        <span className={`text-[11px] tabular-nums font-medium ${isOver ? "text-red-500" : "text-text-secondary"}`}>
          {lesson.totalMinutes}/{lessonLength}m
        </span>
        {isOver && (
          <span className="text-[9px] text-red-400 font-medium bg-red-50 px-1.5 py-0.5 rounded">
            +{lesson.totalMinutes - lessonLength}m over
          </span>
        )}
      </div>

      {/* Duration bar — color segments by activity role */}
      <div className="flex gap-px h-[4px] rounded-full overflow-hidden bg-gray-100 mb-5">
        {activities.map((a) => (
          <div
            key={a.id}
            className="rounded-sm transition-all duration-300"
            style={{
              flex: a.durationMinutes,
              backgroundColor: ROLE_COLORS[a.role] || ROLE_COLORS.core,
              opacity: 0.85,
            }}
            title={`${a.title} (${a.durationMinutes}m)`}
          />
        ))}
        {isOver && (
          <div
            className="rounded-sm bg-red-400"
            style={{ flex: lesson.totalMinutes - lessonLength }}
            title={`Overrun: +${lesson.totalMinutes - lessonLength}m`}
          />
        )}
      </div>

      {/* Activity cards — responsive grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {activities.map((activity, localIdx) => {
          const globalIndex = globalIndexOffset + localIdx;
          return (
            <div
              key={activity.id}
              ref={(el) => {
                if (el) cardRefs.current.set(activity.id, el);
                else cardRefs.current.delete(activity.id);
              }}
              className="deck-card-deal"
              style={{ animationDelay: `${localIdx * 60}ms` }}
            >
              <DeckActivityCard
                activity={activity}
                index={globalIndex}
                totalCount={totalActivityCount}
                dispatch={dispatch}
                isBeingDragged={draggedActivityId === activity.id}
                isRegenerating={regeneratingActivityId === activity.id}
                fanIndex={localIdx}
                fanTotal={activities.length}
                isFanned={true}
                onDragStart={() => onDragStart(activity.id)}
                onRegenerateActivity={onRegenerateActivity}
              />
            </div>
          );
        })}

        {/* Add card button */}
        <button
          onClick={handleAddCard}
          className="deck-add-card group"
        >
          <div className="flex flex-col items-center justify-center gap-1.5 text-text-tertiary group-hover:text-brand-purple transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-[10px] font-medium">Add Card</span>
          </div>
        </button>
      </div>
    </div>
  );
}
