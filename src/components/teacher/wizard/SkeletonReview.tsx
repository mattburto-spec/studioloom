"use client";

import { useCallback } from "react";
import type { WizardState, WizardDispatch } from "@/hooks/useWizardState";
import type { TimelineLessonSkeleton } from "@/types";

const PHASE_COLORS: Record<string, string> = {
  Research: "bg-blue-100 text-blue-700",
  Ideation: "bg-purple-100 text-purple-700",
  Planning: "bg-indigo-100 text-indigo-700",
  "Skill Building": "bg-amber-100 text-amber-700",
  Making: "bg-green-100 text-green-700",
  Testing: "bg-orange-100 text-orange-700",
  Iteration: "bg-teal-100 text-teal-700",
  Evaluation: "bg-rose-100 text-rose-700",
  Presentation: "bg-pink-100 text-pink-700",
};

const CRITERION_COLORS: Record<string, string> = {
  A: "bg-blue-500",
  B: "bg-green-500",
  C: "bg-orange-500",
  D: "bg-purple-500",
};

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onBuildActivities: () => void;
  onBack: () => void;
}

export function SkeletonReview({ state, dispatch, onBuildActivities, onBack }: Props) {
  const skeleton = state.timelineSkeleton;
  const isLoading = state.skeletonStatus === "loading";

  const handleTitleChange = useCallback(
    (lessonId: string, title: string) => {
      dispatch({ type: "UPDATE_SKELETON_LESSON", lessonId, updates: { title } });
    },
    [dispatch]
  );

  const handleKeyQuestionChange = useCallback(
    (lessonId: string, keyQuestion: string) => {
      dispatch({ type: "UPDATE_SKELETON_LESSON", lessonId, updates: { keyQuestion } });
    },
    [dispatch]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      dispatch({ type: "REORDER_SKELETON_LESSON", fromIndex: index, toIndex: index - 1 });
    },
    [dispatch]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (!skeleton || index >= skeleton.lessons.length - 1) return;
      dispatch({ type: "REORDER_SKELETON_LESSON", fromIndex: index, toIndex: index + 1 });
    },
    [dispatch, skeleton]
  );

  const handleDelete = useCallback(
    (lessonId: string) => {
      if (!skeleton || skeleton.lessons.length <= 1) return;
      dispatch({ type: "DELETE_SKELETON_LESSON", lessonId });
    },
    [dispatch, skeleton]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-brand-purple/5 border border-brand-purple/10">
            <div className="w-4 h-4 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">
              Building your lesson outline...
            </span>
          </div>
          <p className="text-xs text-text-tertiary mt-4">
            This takes about 10-15 seconds
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.skeletonStatus === "error") {
    return (
      <div className="max-w-3xl mx-auto py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {state.error || "Failed to generate skeleton"}
          </div>
          <button
            onClick={onBack}
            className="mt-4 text-xs text-text-secondary hover:text-text-primary underline"
          >
            Back to Approaches
          </button>
        </div>
      </div>
    );
  }

  if (!skeleton) return null;

  // Group lessons by phase for visual grouping (contiguous runs)
  const phases: { label: string; groupKey: string; lessons: Array<{ lesson: TimelineLessonSkeleton; index: number }> }[] = [];
  let currentPhase = "";
  let groupCounter = 0;
  for (let i = 0; i < skeleton.lessons.length; i++) {
    const lesson = skeleton.lessons[i];
    if (lesson.phaseLabel !== currentPhase) {
      currentPhase = lesson.phaseLabel;
      groupCounter++;
      phases.push({ label: currentPhase, groupKey: `${currentPhase}-${groupCounter}`, lessons: [] });
    }
    phases[phases.length - 1].lessons.push({ lesson, index: i });
  }

  const totalMinutes = skeleton.lessons.reduce((sum, l) => sum + l.estimatedMinutes, 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-xs text-text-secondary hover:text-text-primary transition mb-3 flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Approaches
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          Lesson Outline
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Review and adjust the lesson flow before generating full activities. Edit titles, reorder lessons, or remove ones you don&apos;t need.
        </p>
      </div>

      {/* Narrative arc */}
      {skeleton.narrativeArc && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-brand-purple/5 to-blue-50/50 border border-brand-purple/10">
          <p className="text-xs font-medium text-brand-purple mb-1">Unit Arc</p>
          <p className="text-sm text-text-secondary leading-relaxed">{skeleton.narrativeArc}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-xs text-text-tertiary">
        <span>{skeleton.lessons.length} lessons</span>
        <span>{Math.round(totalMinutes / 60)} hours total</span>
        <span>{phases.length} phases</span>
      </div>

      {/* Lesson list grouped by phase */}
      <div className="space-y-6">
        {phases.map((phase) => (
          <div key={phase.groupKey}>
            {/* Phase header */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  PHASE_COLORS[phase.label] || "bg-gray-100 text-gray-600"
                }`}
              >
                {phase.label}
              </span>
              <div className="flex-1 h-px bg-border-default" />
              <span className="text-[10px] text-text-tertiary">
                {phase.lessons.length} lesson{phase.lessons.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Lesson cards */}
            <div className="space-y-1.5">
              {phase.lessons.map(({ lesson, index }) => (
                <LessonSkeletonCard
                  key={`lesson-${index}`}
                  lesson={lesson}
                  index={index}
                  totalLessons={skeleton.lessons.length}
                  onTitleChange={(title) => handleTitleChange(lesson.lessonId, title)}
                  onKeyQuestionChange={(q) => handleKeyQuestionChange(lesson.lessonId, q)}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  onDelete={() => handleDelete(lesson.lessonId)}
                  canDelete={skeleton.lessons.length > 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Build button */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={onBuildActivities}
          className="px-6 py-3 rounded-xl bg-brand-purple text-white font-medium text-sm hover:bg-brand-purple/90 transition-colors shadow-sm flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Build Activities
          <span className="text-white/60 text-xs">({skeleton.lessons.length} lessons)</span>
        </button>
      </div>
    </div>
  );
}

// --- Lesson skeleton card ---

function LessonSkeletonCard({
  lesson,
  index,
  totalLessons,
  onTitleChange,
  onKeyQuestionChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  canDelete,
}: {
  lesson: TimelineLessonSkeleton;
  index: number;
  totalLessons: number;
  onTitleChange: (title: string) => void;
  onKeyQuestionChange: (q: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="group flex items-start gap-2 p-3 rounded-lg border border-border-default hover:border-border-hover bg-white transition-colors">
      {/* Lesson number */}
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[11px] font-semibold text-text-secondary mt-0.5">
        {lesson.lessonNumber}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title — inline editable */}
        <input
          type="text"
          value={lesson.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full text-sm font-medium text-text-primary bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-text-tertiary"
          placeholder="Lesson title..."
        />

        {/* Key question — inline editable */}
        <input
          type="text"
          value={lesson.keyQuestion}
          onChange={(e) => onKeyQuestionChange(e.target.value)}
          className="w-full text-xs text-text-secondary bg-transparent border-none outline-none focus:ring-0 p-0 mt-0.5 placeholder:text-text-tertiary"
          placeholder="Driving question..."
        />

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-text-tertiary">{lesson.estimatedMinutes}min</span>

          {/* Criterion pips */}
          <div className="flex items-center gap-0.5">
            {(lesson.criterionTags || []).map((tag) => (
              <div
                key={tag}
                className={`w-4 h-1.5 rounded-full ${CRITERION_COLORS[tag] || "bg-gray-300"}`}
                title={`Criterion ${tag}`}
              />
            ))}
          </div>

          {/* Activity hints */}
          <div className="flex-1 text-[10px] text-text-tertiary truncate">
            {(lesson.activityHints || []).slice(0, 3).join(" \u2022 ")}
          </div>
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 rounded hover:bg-gray-100 text-text-tertiary hover:text-text-secondary disabled:opacity-30"
          title="Move up"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalLessons - 1}
          className="p-1 rounded hover:bg-gray-100 text-text-tertiary hover:text-text-secondary disabled:opacity-30"
          title="Move down"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {canDelete && (
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 text-text-tertiary hover:text-red-500"
            title="Remove lesson"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
