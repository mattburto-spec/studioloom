"use client";

import { useEffect, useRef } from "react";
import { getCriterionDisplay, PAGE_TYPE_COLORS, type CriterionKey } from "@/lib/constants";
import type { WizardState, WizardDispatch } from "@/hooks/useWizardState";
import { JourneyLessonCard } from "./JourneyLessonCard";
import { ThinkingMessage } from "./ThinkingMessage";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onActivityDrop?: (pageId: string, activityId: string) => void;
  onRegeneratePage?: (pageId: string) => void;
}

export function JourneyBuilder({ state, dispatch, onActivityDrop, onRegeneratePage }: Props) {
  const { generatedPages, expandedPages, revealedLessons, generationBatches, journeyInput, phase } = state;
  const lastRevealedRef = useRef<HTMLDivElement>(null);
  const lessonColor = PAGE_TYPE_COLORS.lesson;

  // If entering review phase with no reveals (e.g. page refresh), reveal everything
  useEffect(() => {
    if (phase === "review" && revealedLessons.length === 0 && Object.keys(generatedPages).length > 0) {
      dispatch({ type: "REVEAL_ALL_LESSONS" });
    }
  }, [phase, revealedLessons.length, generatedPages, dispatch]);

  // Scroll to last revealed lesson
  useEffect(() => {
    if (lastRevealedRef.current && phase === "generating") {
      lastRevealedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [revealedLessons.length, phase]);

  const allDone = generationBatches.length > 0 && generationBatches.every(b => b.status === "done");
  const isGenerating = phase === "generating" && !allDone;

  // Get the selected outline for approach name
  const outline = state.selectedJourneyOutline !== null
    ? state.journeyOutlineOptions[state.selectedJourneyOutline]
    : null;

  // Get all expected lesson IDs from outline
  const allLessonIds = outline?.lessonPlan.map(l => l.lessonId) ||
    Object.keys(generatedPages).filter(id => id.startsWith("L")).sort();

  // Primary criterion color for a lesson
  function getLessonColor(pageId: string): string {
    const content = generatedPages[pageId];
    if (!content?.sections) return lessonColor;
    const tags = content.sections.flatMap(s => s.criterionTags || []);
    const primary = [...new Set(tags)][0] as CriterionKey | undefined;
    return primary ? getCriterionDisplay(primary, state.input.unitType, state.input.framework)?.color || lessonColor : lessonColor;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* End Goal Card — pinned at top */}
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

        {/* Connector from goal to timeline */}
        {(revealedLessons.length > 0 || isGenerating) && (
          <div className="flex justify-center">
            <div className="w-0.5 h-6 bg-border-default" />
          </div>
        )}
      </div>

      {/* Thinking Message */}
      {isGenerating && (
        <ThinkingMessage
          batches={generationBatches}
          endGoal={journeyInput.endGoal}
          isComplete={allDone}
        />
      )}

      {/* Lesson Timeline */}
      <div className="relative">
        {/* Vertical connector line */}
        {revealedLessons.length > 1 && (
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border-default/60 z-0" />
        )}

        <div className="space-y-2">
          {revealedLessons.map((lessonId, index) => {
            const content = generatedPages[lessonId];
            if (!content) return null;
            const isExpanded = expandedPages.has(lessonId);
            const isLast = index === revealedLessons.length - 1;
            const color = getLessonColor(lessonId);

            return (
              <div
                key={lessonId}
                ref={isLast ? lastRevealedRef : undefined}
                className="relative animate-slide-up-spring flex gap-3"
              >
                <div className="flex flex-col items-center flex-shrink-0 z-10">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <JourneyLessonCard
                    pageId={lessonId}
                    content={content}
                    color={color}
                    isExpanded={isExpanded}
                    dispatch={dispatch}
                    onActivityDrop={onActivityDrop}
                    onRegeneratePage={onRegeneratePage}
                    pulseScore={state.pulseScores?.[lessonId] ?? null}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pending ghost cards */}
        {isGenerating && (() => {
          const nextUnrevealed = allLessonIds
            .filter(id => !revealedLessons.includes(id))
            .slice(0, 2);

          if (nextUnrevealed.length === 0) return null;

          return (
            <div className="space-y-2 ml-[52px] mt-2">
              {nextUnrevealed.map((lessonId, i) => {
                const outlineLesson = outline?.lessonPlan.find(l => l.lessonId === lessonId);
                return (
                  <div
                    key={lessonId}
                    className="rounded-xl border border-dashed border-border-default/50 px-4 py-3 animate-pulse"
                    style={{ opacity: 0.35 - i * 0.12 }}
                  >
                    <span className="text-xs text-text-tertiary/50 truncate">
                      {outlineLesson?.title || "..."}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Completion message */}
      {allDone && revealedLessons.length > 0 && (
        <div className="text-center mt-8 animate-slide-up">
          <p className="text-sm text-text-secondary">
            {revealedLessons.length} lessons ready. Click any lesson to review and edit.
          </p>
        </div>
      )}
    </div>
  );
}
