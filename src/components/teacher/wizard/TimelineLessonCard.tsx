"use client";

import { useRef } from "react";
import type { ComputedLesson, TimelineActivity } from "@/types";
import type { WizardDispatch } from "@/hooks/useWizardState";
import { TimelineActivityCard } from "./TimelineActivityCard";

const ROLE_COLORS: Record<string, string> = {
  warmup: "#fbbf24",
  intro: "#60a5fa",
  core: "#7B2FF2",
  reflection: "#8b5cf6",
};

interface Props {
  lesson: ComputedLesson;
  activities: TimelineActivity[];
  lessonLength: number;
  isExpanded: boolean;
  onToggle: () => void;
  dispatch: WizardDispatch;
  totalActivityCount: number;
  globalIndexOffset: number;
  draggedActivityId: string | null;
  insertAtIndex: number | null;
  regeneratingActivityId: string | null;
  phaseLabel?: string;
  isGenerating?: boolean;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onDragStart: (activityId: string) => void;
  onInsertActivity: (afterGlobalIndex: number) => void;
  onRegenerateActivity?: (activityId: string) => void;
}

/** Thin duration bar — colored segments proportional to each activity's duration */
function DurationBar({ activities, lessonLength }: { activities: TimelineActivity[]; lessonLength: number }) {
  const totalMin = activities.reduce((s, a) => s + a.durationMinutes, 0);
  const isOver = totalMin > lessonLength;

  return (
    <div className="flex gap-px h-[3px] rounded-full overflow-hidden bg-gray-100 mt-1">
      {activities.map((a) => (
        <div
          key={a.id}
          className="rounded-sm transition-all duration-300"
          style={{
            flex: a.durationMinutes,
            backgroundColor: ROLE_COLORS[a.role] || ROLE_COLORS.core,
            opacity: 0.8,
          }}
          title={`${a.title} (${a.durationMinutes}m)`}
        />
      ))}
      {isOver && (
        <div
          className="rounded-sm bg-red-400"
          style={{ flex: totalMin - lessonLength }}
          title={`Overrun: +${totalMin - lessonLength}m`}
        />
      )}
    </div>
  );
}

export function TimelineLessonCard({
  lesson,
  activities,
  lessonLength,
  isExpanded,
  onToggle,
  dispatch,
  totalActivityCount,
  globalIndexOffset,
  draggedActivityId,
  insertAtIndex,
  regeneratingActivityId,
  phaseLabel,
  isGenerating,
  cardRefs,
  onDragStart,
  onInsertActivity,
  onRegenerateActivity,
}: Props) {
  const isOver = lesson.totalMinutes > lessonLength;
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      {/* Lesson divider header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 group cursor-pointer"
      >
        {/* Left line */}
        <div className="h-px flex-1 bg-border max-w-[12px]" />

        {/* Lesson label */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] font-semibold ${isOver ? "text-red-500" : "text-text-secondary"}`}>
            Lesson {lesson.lessonNumber}
          </span>
          <span className={`text-[10px] tabular-nums ${isOver ? "text-red-400" : "text-text-tertiary"}`}>
            {lesson.totalMinutes}/{lessonLength}m
            {isOver && (
              <span className="text-red-400 ml-0.5">+{lesson.totalMinutes - lessonLength}</span>
            )}
          </span>
          {phaseLabel && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-purple/5 text-brand-purple/50 font-medium">
              {phaseLabel}
            </span>
          )}
        </div>

        {/* Right line */}
        <div className="h-px flex-1 bg-border" />

        {/* Activity count + chevron */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-text-tertiary">
            {activities.length}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-text-tertiary transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Duration bar — always visible */}
      <div className="px-4">
        <DurationBar activities={activities} lessonLength={lessonLength} />
      </div>

      {/* Expandable content — activity blocks */}
      <div className={`drawer-content ${isExpanded ? "open" : ""}`}>
        <div ref={contentRef}>
          {isExpanded && (
            <div className="pt-2 pb-1">
              {/* Drag insertion line before first activity */}
              {draggedActivityId && insertAtIndex === globalIndexOffset && (
                <div className="mx-4 my-1">
                  <div className="timeline-insert-line" />
                </div>
              )}

              {activities.map((activity, localIdx) => {
                const globalIndex = globalIndexOffset + localIdx;
                const isLast = localIdx === activities.length - 1;

                return (
                  <div key={activity.id}>
                    <div
                      ref={(el) => {
                        if (el) cardRefs.current.set(activity.id, el);
                        else cardRefs.current.delete(activity.id);
                      }}
                      className={isGenerating ? "animate-slide-up-spring" : ""}
                    >
                      <TimelineActivityCard
                        activity={activity}
                        index={globalIndex}
                        totalCount={totalActivityCount}
                        dispatch={dispatch}
                        isBeingDragged={draggedActivityId === activity.id}
                        isRegenerating={regeneratingActivityId === activity.id}
                        onDragStart={() => onDragStart(activity.id)}
                        onRegenerateActivity={onRegenerateActivity}
                      />
                    </div>

                    {/* Drag insertion line after this activity */}
                    {draggedActivityId && insertAtIndex === globalIndex + 1 && draggedActivityId !== activity.id && (
                      <div className="mx-4 my-0.5">
                        <div className="timeline-insert-line" />
                      </div>
                    )}

                    {/* Insert button between activities (review, no drag) */}
                    {!draggedActivityId && !isGenerating && !isLast && (
                      <InsertButton onClick={() => onInsertActivity(globalIndex)} />
                    )}
                  </div>
                );
              })}

              {/* Insert button after last activity */}
              {!draggedActivityId && !isGenerating && activities.length > 0 && (
                <InsertButton onClick={() => onInsertActivity(globalIndexOffset + activities.length - 1)} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Notion-style minimal insert button — thin line with centered + */
function InsertButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="group flex items-center gap-0 py-0 px-4 h-4 -my-1">
      <div className="h-px flex-1 bg-transparent group-hover:bg-brand-purple/15 transition-colors" />
      <button
        onClick={onClick}
        className="flex items-center justify-center w-5 h-5 rounded-full opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all text-text-tertiary hover:text-brand-purple hover:bg-brand-purple/5"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <div className="h-px flex-1 bg-transparent group-hover:bg-brand-purple/15 transition-colors" />
    </div>
  );
}
