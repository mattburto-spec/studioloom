"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { WizardState, WizardDispatch } from "@/hooks/useWizardState";
import type { ComputedLesson, TimelineActivity } from "@/types";
import { TimelineLessonCard } from "./TimelineLessonCard";
import { ThinkingMessage } from "./ThinkingMessage";
import { QualityReportPanel } from "./QualityReportPanel";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onRegenerateActivity?: (activityId: string) => void;
}

/**
 * TimelineBuilder — v4 timeline mode UI (Notion-style).
 *
 * Activities grouped by computed lessons. Lesson headers are thin dividers
 * with duration bars. Activity blocks are flat, Notion-style rows with
 * hover-reveal drag handles. Collapsed by default; expand to see blocks.
 */
export function TimelineBuilder({ state, dispatch, onRegenerateActivity }: Props) {
  const {
    timelineActivities,
    computedLessons,
    revealedActivities,
    timelinePhaseStatuses,
    journeyInput,
    phase,
    draggedActivityId,
    regeneratingActivityId,
  } = state;

  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-reveal everything on entering review phase
  useEffect(() => {
    if (phase === "review" && revealedActivities.length === 0 && timelineActivities.length > 0) {
      dispatch({ type: "REVEAL_ALL_ACTIVITIES" });
    }
  }, [phase, revealedActivities.length, timelineActivities.length, dispatch]);

  const allDone = (state.lessonGenerationStatuses.length > 0 &&
    state.lessonGenerationStatuses.every((s) => s.status === "done"))
    || (timelinePhaseStatuses.length > 0 &&
    timelinePhaseStatuses.every((p) => p.status === "done"));
  const isGenerating = phase === "generating" && !allDone;

  // Get selected outline
  const outline = state.selectedTimelineOutline !== null
    ? state.timelineOutlineOptions[state.selectedTimelineOutline]
    : null;

  // Group activities by computed lesson
  const lessonGroups = useMemo(() => {
    return computedLessons.map((lesson) => ({
      lesson,
      activities: lesson.activityIds
        .map((id) => timelineActivities.find((a) => a.id === id))
        .filter((a): a is TimelineActivity => !!a),
    }));
  }, [computedLessons, timelineActivities]);

  // During generation: auto-expand latest lesson with content
  useEffect(() => {
    if (phase !== "generating") return;
    // Find the last lesson that has activities (the one being generated into)
    for (let i = lessonGroups.length - 1; i >= 0; i--) {
      if (lessonGroups[i].activities.length > 0) {
        setExpandedLessons((prev) => {
          const next = new Set(prev);
          next.add(lessonGroups[i].lesson.lessonNumber);
          return next;
        });
        break;
      }
    }
  }, [phase, lessonGroups]);

  // When drag starts, expand all lessons so drop targets are visible
  useEffect(() => {
    if (draggedActivityId) {
      setExpandedLessons(new Set(computedLessons.map((l) => l.lessonNumber)));
    }
  }, [draggedActivityId, computedLessons]);

  const toggleLesson = useCallback((lessonNumber: number) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonNumber)) {
        next.delete(lessonNumber);
      } else {
        next.add(lessonNumber);
      }
      return next;
    });
  }, []);

  // --- Drag-to-reorder logic ---
  const handleDragStart = useCallback((activityId: string) => {
    dispatch({ type: "SET_DRAGGED_ACTIVITY", activityId });
  }, [dispatch]);

  const handleDragEnd = useCallback(() => {
    if (draggedActivityId && insertAtIndex !== null) {
      const fromIndex = timelineActivities.findIndex((a) => a.id === draggedActivityId);
      if (fromIndex !== -1 && fromIndex !== insertAtIndex) {
        const toIndex = insertAtIndex > fromIndex ? insertAtIndex - 1 : insertAtIndex;
        if (toIndex !== fromIndex) {
          dispatch({ type: "REORDER_ACTIVITY", fromIndex, toIndex });
        }
      }
    }
    dispatch({ type: "SET_DRAGGED_ACTIVITY", activityId: null });
    setInsertAtIndex(null);
  }, [draggedActivityId, insertAtIndex, timelineActivities, dispatch]);

  useEffect(() => {
    if (!draggedActivityId) return;

    const handlePointerMove = (e: PointerEvent) => {
      let bestIndex = 0;
      let bestDist = Infinity;

      cardRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - midY);
        const actIdx = timelineActivities.findIndex((a) => a.id === id);
        if (actIdx === -1) return;

        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = e.clientY < midY ? actIdx : actIdx + 1;
        }
      });

      bestIndex = Math.max(0, Math.min(timelineActivities.length, bestIndex));
      setInsertAtIndex(bestIndex);
    };

    const handlePointerUp = () => {
      handleDragEnd();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedActivityId, timelineActivities, handleDragEnd]);

  // --- Add activity insertion ---
  const handleInsertActivity = useCallback((afterGlobalIndex: number) => {
    const newActivity: TimelineActivity = {
      id: `new_${Date.now().toString(36)}`,
      role: "core",
      title: "New Activity",
      prompt: "Describe what students should do...",
      durationMinutes: 15,
      responseType: "text",
    };
    dispatch({ type: "INSERT_ACTIVITY", afterIndex: afterGlobalIndex, activity: newActivity });
  }, [dispatch]);

  // Compute global index offset for each lesson
  const lessonOffsets = useMemo(() => {
    const offsets: number[] = [];
    let offset = 0;
    for (const group of lessonGroups) {
      offsets.push(offset);
      offset += group.activities.length;
    }
    return offsets;
  }, [lessonGroups]);

  // Track phase labels per lesson (first activity's phaseLabel)
  const lessonPhaseLabels = useMemo(() => {
    return lessonGroups.map((g) => {
      const labels = [...new Set(g.activities.map((a) => a.phaseLabel).filter(Boolean))];
      return labels.length === 1 ? labels[0] : undefined;
    });
  }, [lessonGroups]);

  // Filter visible lessons during generation
  const visibleLessonGroups = isGenerating
    ? lessonGroups.filter((g) => g.activities.some((a) => revealedActivities.includes(a.id)))
    : lessonGroups;

  // Track current phase for phase headers between lessons
  let currentPhaseLabel = "";

  return (
    <div className="max-w-3xl mx-auto">
      {/* End Goal Card */}
      <div className="relative mb-6">
        <div className="rounded-2xl border-2 border-brand-purple/30 bg-gradient-to-br from-brand-purple/5 to-accent-green/5 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-purple">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-purple">End Goal</span>
                {allDone && (
                  <span className="text-[10px] font-medium text-accent-green flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Complete
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-text-primary mt-1 leading-snug">
                {journeyInput.endGoal || journeyInput.topic || "Your learning journey"}
              </p>
              {outline && (
                <p className="text-[11px] text-text-secondary mt-1.5">
                  Approach: {outline.approach}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quality Report */}
      {state.qualityReport && !isGenerating && (
        <div className="mb-4">
          <QualityReportPanel report={state.qualityReport} />
        </div>
      )}

      {/* Thinking Message */}
      {isGenerating && (
        <ThinkingMessage
          batches={timelinePhaseStatuses.map((p) => ({
            lessonIds: [p.phaseId],
            status: p.status,
          }))}
          endGoal={journeyInput.endGoal}
          isComplete={allDone}
          lessonStatuses={state.lessonGenerationStatuses.length > 0 ? state.lessonGenerationStatuses : undefined}
        />
      )}

      {/* Lesson Sections */}
      <div className="flex flex-col gap-0">
        {visibleLessonGroups.map((group, groupIdx) => {
          const actualIdx = lessonGroups.indexOf(group);
          const offset = lessonOffsets[actualIdx] ?? 0;
          const phaseLabel = lessonPhaseLabels[actualIdx];

          // Phase header between lesson cards when phase changes
          let showPhaseHeader = false;
          if (phaseLabel && phaseLabel !== currentPhaseLabel) {
            showPhaseHeader = true;
            currentPhaseLabel = phaseLabel;
          }

          return (
            <div key={group.lesson.lessonId}>
              {/* Phase divider */}
              {showPhaseHeader && (
                <div className="flex items-center gap-2 py-2 px-1">
                  <div className="h-px flex-1 bg-brand-purple/15" />
                  <span className="text-[10px] font-semibold text-brand-purple/60 uppercase tracking-wider whitespace-nowrap">
                    {phaseLabel}
                  </span>
                  <div className="h-px flex-1 bg-brand-purple/15" />
                </div>
              )}

              <TimelineLessonCard
                lesson={group.lesson}
                activities={group.activities}
                lessonLength={journeyInput.lessonLengthMinutes}
                isExpanded={expandedLessons.has(group.lesson.lessonNumber)}
                onToggle={() => toggleLesson(group.lesson.lessonNumber)}
                dispatch={dispatch}
                totalActivityCount={timelineActivities.length}
                globalIndexOffset={offset}
                draggedActivityId={draggedActivityId}
                insertAtIndex={insertAtIndex}
                regeneratingActivityId={regeneratingActivityId}
                phaseLabel={phaseLabel}
                isGenerating={isGenerating}
                cardRefs={cardRefs}
                onDragStart={handleDragStart}
                onInsertActivity={handleInsertActivity}
                onRegenerateActivity={onRegenerateActivity}
              />
            </div>
          );
        })}
      </div>

      {/* Ghost cards during generation */}
      {isGenerating && (() => {
        const pendingPhases = timelinePhaseStatuses.filter((p) => p.status === "idle").slice(0, 2);
        if (pendingPhases.length === 0) return null;
        return (
          <div className="flex flex-col gap-1.5 mt-1.5">
            {pendingPhases.map((p, i) => {
              const phaseInfo = outline?.phases.find((op) => op.phaseId === p.phaseId);
              return (
                <div
                  key={p.phaseId}
                  className="rounded-xl border border-dashed border-border-default/50 px-4 py-3 animate-pulse"
                  style={{ opacity: 0.35 - i * 0.12 }}
                >
                  <span className="text-[10px] text-text-tertiary/50">
                    {phaseInfo?.title || "..."}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Lesson summary bar */}
      {computedLessons.length > 0 && timelineActivities.length > 0 && (
        <LessonSummaryBar
          timelineActivities={timelineActivities}
          computedLessons={computedLessons}
          lessonLengthMinutes={journeyInput.lessonLengthMinutes}
        />
      )}

      {/* Completion message */}
      {allDone && timelineActivities.length > 0 && (
        <div className="text-center mt-8 animate-slide-up">
          <p className="text-sm text-text-secondary">
            {timelineActivities.length} activities across {computedLessons.length} lessons ready.
            Click a lesson to review and edit activities.
          </p>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function LessonSummaryBar({
  timelineActivities,
  computedLessons,
  lessonLengthMinutes,
}: {
  timelineActivities: TimelineActivity[];
  computedLessons: ComputedLesson[];
  lessonLengthMinutes: number;
}) {
  const overrunCount = computedLessons.filter((l) => l.totalMinutes > lessonLengthMinutes).length;

  return (
    <div className="mt-6 p-3 rounded-xl bg-surface-secondary border border-border-default/50">
      <div className="flex items-center justify-between text-[10px] text-text-secondary">
        <span>{timelineActivities.length} activities</span>
        <span>{computedLessons.length} computed lessons</span>
        <span>
          {timelineActivities.reduce((sum, a) => sum + a.durationMinutes, 0)} total min
        </span>
      </div>

      {overrunCount > 0 && (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-red-50 border border-red-100">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[10px] text-red-600 font-medium">
            {overrunCount} {overrunCount === 1 ? "lesson exceeds" : "lessons exceed"} {lessonLengthMinutes} min
          </span>
        </div>
      )}

      <div className="flex gap-0.5 mt-2">
        {computedLessons.map((lesson) => {
          const utilization = lesson.totalMinutes / lessonLengthMinutes;
          const isOver = utilization > 1;
          return (
            <div
              key={lesson.lessonId}
              className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100"
              title={`Lesson ${lesson.lessonNumber}: ${lesson.totalMinutes}/${lessonLengthMinutes} min${isOver ? " ⚠ OVER" : ""}`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  isOver ? "bg-red-400" : utilization > 0.85 ? "bg-accent-green" : "bg-brand-purple/40"
                }`}
                style={{ width: `${Math.min(100, utilization * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
