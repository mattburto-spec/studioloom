"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { WizardState, WizardDispatch } from "@/hooks/useWizardState";
import type { ComputedLesson, TimelineActivity } from "@/types";
import { DeckLessonStack } from "./DeckLessonStack";
import { ThinkingMessage } from "./ThinkingMessage";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onRegenerateActivity?: (activityId: string) => void;
}

const ROLE_COLORS: Record<string, string> = {
  warmup: "#f59e0b",
  intro: "#3b82f6",
  core: "#7B2FF2",
  reflection: "#8b5cf6",
};

/**
 * DeckBuilder — card-deck metaphor for the timeline.
 *
 * Layout: lesson stacks on the left, fanned activity cards on the right
 * when a lesson is selected. Feels like building a complete "deck" for
 * a unit — each lesson is a pile, each activity is a playing card.
 *
 * Bottom: "deck stats" bar showing mana-curve-style distribution.
 */
export function DeckBuilder({ state, dispatch, onRegenerateActivity }: Props) {
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

  const [openLessons, setOpenLessons] = useState<Set<number>>(new Set());
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-reveal on review
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

  // Phase labels per lesson
  const lessonPhaseLabels = useMemo(() => {
    return lessonGroups.map((g) => {
      const labels = [...new Set(g.activities.map((a) => a.phaseLabel).filter(Boolean))];
      return labels.length === 1 ? labels[0] : undefined;
    });
  }, [lessonGroups]);

  // Lesson offsets for global indexing
  const lessonOffsets = useMemo(() => {
    const offsets: number[] = [];
    let offset = 0;
    for (const group of lessonGroups) {
      offsets.push(offset);
      offset += group.activities.length;
    }
    return offsets;
  }, [lessonGroups]);

  // Auto-open first lesson when generation completes
  useEffect(() => {
    if (allDone && openLessons.size === 0 && lessonGroups.length > 0) {
      setOpenLessons(new Set([lessonGroups[0].lesson.lessonNumber]));
    }
  }, [allDone, openLessons.size, lessonGroups]);

  const handleToggleLesson = useCallback((lessonNumber: number) => {
    setOpenLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonNumber)) {
        next.delete(lessonNumber);
      } else {
        next.add(lessonNumber);
      }
      return next;
    });
  }, []);

  // Drag-to-reorder
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
    const handlePointerUp = () => handleDragEnd();
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedActivityId, timelineActivities, handleDragEnd]);

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

  // Mana curve data — minutes per lesson
  const manaCurve = useMemo(() => {
    return computedLessons.map((l) => ({
      lessonNumber: l.lessonNumber,
      totalMinutes: l.totalMinutes,
      roleBreakdown: l.activityIds
        .map((id) => timelineActivities.find((a) => a.id === id))
        .filter((a): a is TimelineActivity => !!a)
        .reduce((acc, a) => {
          acc[a.role] = (acc[a.role] || 0) + a.durationMinutes;
          return acc;
        }, {} as Record<string, number>),
    }));
  }, [computedLessons, timelineActivities]);

  const maxMinutes = Math.max(
    journeyInput.lessonLengthMinutes,
    ...manaCurve.map((m) => m.totalMinutes)
  );

  // Visible lessons during generation
  const visibleLessonGroups = isGenerating
    ? lessonGroups.filter((g) => g.activities.some((a) => revealedActivities.includes(a.id)))
    : lessonGroups;

  return (
    <div className="max-w-4xl mx-auto">
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

      {/* Lesson rows — fisheye stacks on left, cards fan to the right */}
      <DeckFisheyeLayout
        lessonGroups={visibleLessonGroups}
        allLessonGroups={lessonGroups}
        lessonPhaseLabels={lessonPhaseLabels}
        lessonOffsets={lessonOffsets}
        lessonLength={journeyInput.lessonLengthMinutes}
        openLessons={openLessons}
        onToggleLesson={handleToggleLesson}
        dispatch={dispatch}
        totalActivityCount={timelineActivities.length}
        timelineActivities={timelineActivities}
        draggedActivityId={draggedActivityId}
        regeneratingActivityId={regeneratingActivityId}
        cardRefs={cardRefs}
        onDragStart={handleDragStart}
        onInsertActivity={handleInsertActivity}
        onRegenerateActivity={onRegenerateActivity}
        isGenerating={isGenerating}
        timelinePhaseStatuses={timelinePhaseStatuses}
        outline={outline}
      />

      {/* BOTTOM: Deck stats — mana curve style */}
      {computedLessons.length > 0 && timelineActivities.length > 0 && (
        <DeckStatsBar
          manaCurve={manaCurve}
          maxMinutes={maxMinutes}
          lessonLengthMinutes={journeyInput.lessonLengthMinutes}
          totalActivities={timelineActivities.length}
          totalLessons={computedLessons.length}
          openLessons={openLessons}
          onToggleLesson={handleToggleLesson}
        />
      )}

      {/* Completion message */}
      {allDone && timelineActivities.length > 0 && (
        <div className="text-center mt-6 animate-slide-up">
          <p className="text-sm text-text-secondary">
            Your deck is ready — {timelineActivities.length} cards across {computedLessons.length} lessons.
          </p>
        </div>
      )}
    </div>
  );
}

// --- Fisheye Layout: scrolls lesson stacks with center-focused scaling ---

function DeckFisheyeLayout({
  lessonGroups,
  allLessonGroups,
  lessonPhaseLabels,
  lessonOffsets,
  lessonLength,
  openLessons,
  onToggleLesson,
  dispatch,
  totalActivityCount,
  timelineActivities,
  draggedActivityId,
  regeneratingActivityId,
  cardRefs,
  onDragStart,
  onInsertActivity,
  onRegenerateActivity,
  isGenerating,
  timelinePhaseStatuses,
  outline,
}: {
  lessonGroups: { lesson: ComputedLesson; activities: TimelineActivity[] }[];
  allLessonGroups: { lesson: ComputedLesson; activities: TimelineActivity[] }[];
  lessonPhaseLabels: (string | undefined)[];
  lessonOffsets: number[];
  lessonLength: number;
  openLessons: Set<number>;
  onToggleLesson: (n: number) => void;
  dispatch: WizardDispatch;
  totalActivityCount: number;
  timelineActivities: TimelineActivity[];
  draggedActivityId: string | null;
  regeneratingActivityId: string | null;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onDragStart: (activityId: string) => void;
  onInsertActivity: (afterGlobalIndex: number) => void;
  onRegenerateActivity?: (activityId: string) => void;
  isGenerating: boolean;
  timelinePhaseStatuses: { phaseId: string; status: string }[];
  outline: { phases: { phaseId: string; title: string }[] } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [proximities, setProximities] = useState<Map<string, number>>(new Map());

  // Calculate proximity of each lesson card to viewport center
  const recalcProximities = useCallback(() => {
    if (!containerRef.current) return;
    const viewportCenter = window.innerHeight / 2;

    const newProximities = new Map<string, number>();
    rowRefs.current.forEach((el, lessonId) => {
      const rect = el.getBoundingClientRect();
      const cardCenter = rect.top + rect.height / 2;
      const distance = Math.abs(cardCenter - viewportCenter);
      // 0 = at center (biggest), 1 = far away (smallest)
      // Use 300px as the falloff range
      const proximity = Math.max(0, Math.min(1, 1 - distance / 350));
      newProximities.set(lessonId, proximity);
    });
    setProximities(newProximities);
  }, []);

  useEffect(() => {
    recalcProximities();
    window.addEventListener("scroll", recalcProximities, { passive: true });
    window.addEventListener("resize", recalcProximities, { passive: true });
    return () => {
      window.removeEventListener("scroll", recalcProximities);
      window.removeEventListener("resize", recalcProximities);
    };
  }, [recalcProximities, lessonGroups.length]);

  // Also recalc when open lessons change (layout shift)
  useEffect(() => {
    requestAnimationFrame(recalcProximities);
  }, [openLessons, recalcProximities]);

  const hasAnyOpen = openLessons.size > 0;

  // Pick a muted background color per lesson (cycling through a palette)
  const LESSON_BG_COLORS = [
    "rgba(123,47,242,0.04)",   // purple
    "rgba(59,130,246,0.04)",   // blue
    "rgba(45,160,94,0.04)",    // green
    "rgba(245,158,11,0.04)",   // amber
    "rgba(239,68,68,0.04)",    // red
    "rgba(139,92,246,0.04)",   // violet
  ];
  const LESSON_BORDER_COLORS = [
    "rgba(123,47,242,0.15)",
    "rgba(59,130,246,0.15)",
    "rgba(45,160,94,0.15)",
    "rgba(245,158,11,0.15)",
    "rgba(239,68,68,0.15)",
    "rgba(139,92,246,0.15)",
  ];

  return (
    <div ref={containerRef} className="space-y-2">
      {lessonGroups.map((group) => {
        const actualIdx = allLessonGroups.indexOf(group);
        const phaseLabel = lessonPhaseLabels[actualIdx];
        const offset = lessonOffsets[actualIdx] ?? 0;
        const isOpen = openLessons.has(group.lesson.lessonNumber);
        const proximity = proximities.get(group.lesson.lessonId) ?? 0.5;

        // When lessons are open: closed ones shrink to mini, open ones stay medium
        const isMini = hasAnyOpen && !isOpen;
        const effectiveWidth = hasAnyOpen
          ? isOpen ? 140 : lerp(72, 90, proximity)
          : lerp(140, 220, proximity);

        const bgColor = LESSON_BG_COLORS[actualIdx % LESSON_BG_COLORS.length];
        const borderColor = LESSON_BORDER_COLORS[actualIdx % LESSON_BORDER_COLORS.length];

        return (
          <div
            key={group.lesson.lessonId}
            ref={(el) => {
              if (el) rowRefs.current.set(group.lesson.lessonId, el);
              else rowRefs.current.delete(group.lesson.lessonId);
            }}
            className={`flex items-center gap-0 transition-all duration-300 rounded-2xl ${isOpen ? "py-2" : ""}`}
            style={{
              backgroundColor: isOpen ? bgColor : "transparent",
              border: isOpen ? `1px solid ${borderColor}` : "1px solid transparent",
            }}
          >
            {/* Left: lesson stack */}
            <div
              className="flex-shrink-0 transition-all duration-300 ease-out px-2"
              style={{
                width: `${effectiveWidth + 16}px`,
                transformOrigin: "left center",
              }}
            >
              <LessonStackCard
                lesson={group.lesson}
                activities={group.activities}
                lessonLength={lessonLength}
                isActive={isOpen}
                phaseLabel={phaseLabel}
                proximity={isMini ? 0 : proximity}
                isMini={isMini}
                onClick={() => onToggleLesson(group.lesson.lessonNumber)}
              />
            </div>

            {/* Right: fanned activity cards on colored band */}
            {isOpen && (
              <div className="flex-1 min-w-0 pr-3 py-1">
                <DeckLessonStack
                  key={`fan-${group.lesson.lessonId}`}
                  lesson={group.lesson}
                  activities={group.activities}
                  lessonLength={lessonLength}
                  isSelected={true}
                  onSelect={() => onToggleLesson(group.lesson.lessonNumber)}
                  dispatch={dispatch}
                  totalActivityCount={totalActivityCount}
                  globalIndexOffset={offset}
                  draggedActivityId={draggedActivityId}
                  regeneratingActivityId={regeneratingActivityId}
                  phaseLabel={phaseLabel}
                  cardRefs={cardRefs}
                  onDragStart={onDragStart}
                  onInsertActivity={onInsertActivity}
                  onRegenerateActivity={onRegenerateActivity}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Ghost stacks during generation */}
      {isGenerating && (() => {
        const pendingPhases = timelinePhaseStatuses.filter((p) => p.status === "idle").slice(0, 2);
        if (pendingPhases.length === 0) return null;
        return pendingPhases.map((p, i) => {
          const phaseInfo = outline?.phases.find((op) => op.phaseId === p.phaseId);
          return (
            <div
              key={p.phaseId}
              className="rounded-xl border border-dashed border-border-default/50 px-3 py-4 animate-pulse"
              style={{ width: 140, opacity: 0.35 - i * 0.12 }}
            >
              <span className="text-[9px] text-text-tertiary/50">
                {phaseInfo?.title || "..."}
              </span>
            </div>
          );
        });
      })()}
    </div>
  );
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// --- Lesson Stack Card (fisheye-aware, progressive detail) ---

function LessonStackCard({
  lesson,
  activities,
  lessonLength,
  isActive,
  phaseLabel,
  proximity,
  isMini,
  onClick,
}: {
  lesson: ComputedLesson;
  activities: TimelineActivity[];
  lessonLength: number;
  isActive: boolean;
  phaseLabel?: string;
  /** 0 = far from center (small), 1 = at center (big). Controls detail level. */
  proximity: number;
  /** When another lesson is selected, non-active cards go mini */
  isMini: boolean;
  onClick: () => void;
}) {
  const isOver = lesson.totalMinutes > lessonLength;
  const utilization = lesson.totalMinutes / lessonLength;

  // ---- MINI MODE: just lesson number + role spine + badge ----
  if (isMini) {
    return (
      <button
        onClick={onClick}
        className="deck-stack group relative w-full text-left transition-all duration-300 hover:scale-105"
      >
        {/* Depth cards */}
        {activities.length > 1 && (
          <div
            className="absolute inset-0 rounded-lg border border-gray-200/50 bg-white"
            style={{ transform: "translateY(-1px) translateX(0.5px) rotate(0.5deg)" }}
          />
        )}
        <div className={`relative rounded-lg border bg-white overflow-hidden transition-all ${
          isOver ? "border-red-200" : "border-gray-200 hover:border-gray-300"
        }`}>
          {/* Role spine */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 flex flex-col overflow-hidden rounded-l-lg">
            {activities.map((a, i) => (
              <div key={i} style={{ flex: a.durationMinutes, backgroundColor: ROLE_COLORS[a.role] || ROLE_COLORS.core, opacity: 0.85 }} />
            ))}
          </div>
          <div className="pl-2 pr-1.5 py-1.5 flex items-center justify-between">
            <span className={`text-[11px] font-bold ${isOver ? "text-red-500" : "text-text-primary"}`}>
              L{lesson.lessonNumber}
            </span>
            <span className="text-[8px] text-text-tertiary tabular-nums">{lesson.totalMinutes}m</span>
          </div>
        </div>
        {/* Badge */}
        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gray-400 text-white text-[7px] font-bold flex items-center justify-center">
          {activities.length}
        </div>
      </button>
    );
  }

  // ---- NORMAL/FISHEYE MODE ----
  // Progressive disclosure: how many activity titles to show (no prompts — just titles)
  const showCount = proximity > 0.7 ? 4 : proximity > 0.4 ? 3 : 2;

  return (
    <button
      onClick={onClick}
      className={`deck-stack group relative w-full text-left transition-all duration-300 ${
        isActive ? "" : "hover:scale-[1.01]"
      }`}
    >
      {/* Stacked card edges (fake depth) */}
      {activities.length > 2 && (
        <div
          className="absolute inset-0 rounded-xl border border-gray-200/50 bg-white"
          style={{ transform: `translateY(-${lerp(1.5, 3, proximity)}px) translateX(${lerp(0.5, 1.5, proximity)}px) rotate(${lerp(0.5, 1.2, proximity)}deg)` }}
        />
      )}
      {activities.length > 1 && (
        <div
          className="absolute inset-0 rounded-xl border border-gray-200/70 bg-white"
          style={{ transform: `translateY(-${lerp(0.75, 1.5, proximity)}px) translateX(${lerp(0.25, 0.75, proximity)}px) rotate(${lerp(0.25, 0.6, proximity)}deg)` }}
        />
      )}

      {/* Main card face */}
      <div className={`relative rounded-xl border bg-white overflow-hidden transition-all ${
        isActive
          ? "border-brand-purple/40 shadow-lg ring-2 ring-brand-purple/20"
          : isOver
            ? "border-red-200 shadow-sm"
            : "border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
      }`}>
        {/* Role color spine on left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col overflow-hidden rounded-l-xl">
          {activities.map((a, i) => (
            <div key={i} style={{ flex: a.durationMinutes, backgroundColor: ROLE_COLORS[a.role] || ROLE_COLORS.core, opacity: 0.85 }} />
          ))}
        </div>

        <div className="pl-3 pr-2 py-2">
          {/* Lesson header */}
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`font-bold leading-none ${isActive ? "text-brand-purple" : isOver ? "text-red-500" : "text-text-primary"}`}
              style={{ fontSize: `${lerp(11, 14, proximity)}px` }}
            >
              L{lesson.lessonNumber}
            </span>
            {phaseLabel && proximity > 0.35 && (
              <span className="text-[8px] px-1 py-px rounded bg-brand-purple/5 text-brand-purple/50 font-medium truncate max-w-[80px]">
                {phaseLabel}
              </span>
            )}
            <div className="flex-1" />
            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-pulse" />}
          </div>

          {/* Activity titles only — concise, no prompts */}
          <div className="space-y-0.5 mb-1.5">
            {activities.slice(0, showCount).map((a) => (
              <div key={a.id} className="flex items-center gap-1 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ROLE_COLORS[a.role] || ROLE_COLORS.core }} />
                <span className="text-[10px] text-text-secondary truncate leading-tight">{a.title}</span>
              </div>
            ))}
            {activities.length > showCount && (
              <span className="text-[8px] text-text-tertiary/60 pl-2.5">+{activities.length - showCount} more</span>
            )}
          </div>

          {/* Duration bar */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : utilization > 0.85 ? "bg-accent-green" : "bg-brand-purple/40"}`}
                style={{ width: `${Math.min(100, utilization * 100)}%` }}
              />
            </div>
            <span className={`text-[9px] tabular-nums font-medium ${isOver ? "text-red-500" : "text-text-tertiary"}`}>
              {lesson.totalMinutes}m
            </span>
          </div>
        </div>
      </div>

      {/* Card count badge */}
      <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shadow-sm transition-all ${
        isActive ? "bg-brand-purple" : "bg-gray-400"
      }`}>
        {activities.length}
      </div>
    </button>
  );
}

// --- Deck Stats / Mana Curve ---

function DeckStatsBar({
  manaCurve,
  maxMinutes,
  lessonLengthMinutes,
  totalActivities,
  totalLessons,
  openLessons,
  onToggleLesson,
}: {
  manaCurve: { lessonNumber: number; totalMinutes: number; roleBreakdown: Record<string, number> }[];
  maxMinutes: number;
  lessonLengthMinutes: number;
  totalActivities: number;
  totalLessons: number;
  openLessons: Set<number>;
  onToggleLesson: (n: number) => void;
}) {
  const overrunCount = manaCurve.filter((m) => m.totalMinutes > lessonLengthMinutes).length;
  const totalMinutes = manaCurve.reduce((s, m) => s + m.totalMinutes, 0);
  const roles = ["warmup", "intro", "core", "reflection"];

  return (
    <div className="mt-6 p-4 rounded-xl bg-surface-secondary border border-border-default/50">
      {/* Stats header */}
      <div className="flex items-center justify-between text-[10px] text-text-secondary mb-3">
        <span className="font-semibold uppercase tracking-wider">Deck Overview</span>
        <div className="flex items-center gap-3">
          <span>{totalActivities} cards</span>
          <span>{totalLessons} lessons</span>
          <span>{totalMinutes} min total</span>
        </div>
      </div>

      {/* Mana curve */}
      <div className="flex items-end gap-1 h-16">
        {manaCurve.map((bar) => {
          const barHeight = (bar.totalMinutes / maxMinutes) * 100;
          const isOver = bar.totalMinutes > lessonLengthMinutes;
          const isSelected = openLessons.has(bar.lessonNumber);

          return (
            <button
              key={bar.lessonNumber}
              onClick={() => onToggleLesson(bar.lessonNumber)}
              className={`flex-1 flex flex-col-reverse rounded-t-sm transition-all hover:opacity-90 ${
                isSelected ? "ring-2 ring-brand-purple/40 ring-offset-1" : ""
              }`}
              style={{ height: `${barHeight}%` }}
              title={`Lesson ${bar.lessonNumber}: ${bar.totalMinutes}m${isOver ? " ⚠ OVER" : ""}`}
            >
              {roles.map((role) => {
                const mins = bar.roleBreakdown[role] || 0;
                if (mins === 0) return null;
                return (
                  <div
                    key={role}
                    style={{
                      flex: mins,
                      backgroundColor: ROLE_COLORS[role],
                      opacity: isSelected ? 1 : 0.7,
                    }}
                    className="transition-opacity first:rounded-t-sm"
                  />
                );
              })}
            </button>
          );
        })}
      </div>

      {/* Lesson length line */}
      <div className="relative -mt-[1px]">
        <div className="flex items-center gap-1">
          <div className={`h-px flex-1 ${overrunCount > 0 ? "bg-red-300" : "bg-gray-300"}`} />
          <span className="text-[8px] text-text-tertiary">{lessonLengthMinutes}m target</span>
        </div>
      </div>

      {/* Lesson numbers */}
      <div className="flex gap-1 mt-1">
        {manaCurve.map((bar) => (
          <div key={bar.lessonNumber} className="flex-1 text-center">
            <span className={`text-[8px] tabular-nums ${
              openLessons.has(bar.lessonNumber) ? "text-brand-purple font-bold" : "text-text-tertiary"
            }`}>
              L{bar.lessonNumber}
            </span>
          </div>
        ))}
      </div>

      {/* Overrun warning */}
      {overrunCount > 0 && (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-red-50 border border-red-100">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[10px] text-red-600 font-medium">
            {overrunCount} {overrunCount === 1 ? "lesson exceeds" : "lessons exceed"} {lessonLengthMinutes}m
          </span>
        </div>
      )}

      {/* Role legend */}
      <div className="flex items-center gap-3 mt-2 justify-center">
        {roles.map((role) => (
          <div key={role} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: ROLE_COLORS[role] }} />
            <span className="text-[8px] text-text-tertiary capitalize">{role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
