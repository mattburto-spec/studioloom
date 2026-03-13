"use client";

import { useState } from "react";
import { CRITERIA } from "@/lib/constants";
import type { WizardState, WizardDispatch } from "@/hooks/useWizardState";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onGenerateOutlines: () => void;
  onGenerateAdditional?: (angleHint: string) => Promise<void>;
}

export function ApproachPicker({ state, dispatch, onGenerateOutlines, onGenerateAdditional }: Props) {
  const { outlineStatus, outlineError, journeyMode } = state;
  const [suggestingIndex, setSuggestingIndex] = useState<number | null>(null);

  // Timeline mode uses timelineOutlineOptions, journey uses journeyOutlineOptions, criterion uses outlineOptions
  const hasTimelineOutlines = state.timelineOutlineOptions.some(Boolean);
  const outlineOptions = hasTimelineOutlines
    ? state.timelineOutlineOptions
    : journeyMode
      ? state.journeyOutlineOptions
      : state.outlineOptions;
  // Count of non-undefined options (for skeleton card count)
  const filledOptionCount = hasTimelineOutlines
    ? state.timelineOutlineOptions.filter(Boolean).length
    : outlineOptions.length;
  const selectedIndex = hasTimelineOutlines
    ? state.selectedTimelineOutline
    : journeyMode
      ? state.selectedJourneyOutline
      : state.selectedOutline;

  function handleSelect(idx: number) {
    if (hasTimelineOutlines) {
      dispatch({ type: "SELECT_TIMELINE_OUTLINE", index: idx });
    } else if (journeyMode) {
      dispatch({ type: "SELECT_JOURNEY_OUTLINE", index: idx });
    } else {
      dispatch({ type: "SELECT_OUTLINE", index: idx });
    }
  }

  async function handleSuggest(angleHint: string) {
    if (!onGenerateAdditional || suggestingIndex !== null) return;
    const nextIndex = outlineOptions.length;
    setSuggestingIndex(nextIndex);
    try {
      await onGenerateAdditional(angleHint);
    } finally {
      setSuggestingIndex(null);
    }
  }

  // Only show suggest buttons when all initial approaches are loaded and mode supports it
  const showSuggestButtons =
    outlineStatus === "done" &&
    filledOptionCount >= 3 &&
    (hasTimelineOutlines || journeyMode) &&
    !!onGenerateAdditional;

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-purple/10 text-brand-purple rounded-full text-xs font-medium mb-3">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
          </svg>
          Choose an approach
        </div>
        <h2 className="text-lg font-bold text-text-primary">
          {journeyMode ? "How should we structure this learning journey?" : "How should we structure this unit?"}
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Each approach takes a different angle on your topic. Pick the one that fits best.
        </p>
      </div>

      {/* Error */}
      {outlineStatus === "error" && (
        <div className="space-y-3 text-center">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {outlineError || "Something went wrong. Let's try again."}
          </div>
          <button
            onClick={onGenerateOutlines}
            className="px-4 py-2 bg-surface-alt rounded-xl text-sm hover:bg-gray-200 transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Idle — trigger generation */}
      {outlineStatus === "idle" && (
        <div className="text-center">
          <button
            onClick={onGenerateOutlines}
            className="px-6 py-3 bg-brand-purple/10 text-brand-purple rounded-xl text-sm font-semibold hover:bg-brand-purple/20 transition"
          >
            Generate Approaches
          </button>
        </div>
      )}

      {/* Outline cards — always render 3 fixed slots; swap skeleton for real card as each arrives */}
      {(filledOptionCount > 0 || outlineStatus === "loading") && (
        <div className="space-y-3">
          {Array.from({ length: Math.max(3, outlineOptions.length) }).map((_, idx) => {
            const option = outlineOptions[idx];
            const colors = [CRITERIA.A.color, CRITERIA.C.color, CRITERIA.B.color, "#7C3AED", "#0891B2"];
            const color = colors[idx % colors.length];

            // Skeleton placeholder for slots not yet filled
            if (!option) {
              return (
                <div
                  key={`slot-${idx}`}
                  className="w-full rounded-2xl border-2 border-border p-5 animate-pulse"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 opacity-40"
                      style={{ backgroundColor: color }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 bg-gray-200 rounded" />
                      <div className="h-3 w-full bg-gray-100 rounded" />
                      <div className="h-3 w-3/4 bg-gray-100 rounded" />
                      <div className="flex gap-1.5 mt-2">
                        <div className="h-4 w-16 bg-gray-100 rounded-full" />
                        <div className="h-4 w-20 bg-gray-100 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Real approach card
            const isSelected = selectedIndex === idx;
            const isJourneyOutline = "lessonPlan" in option;

            return (
              <button
                key={`slot-${idx}`}
                onClick={() => handleSelect(idx)}
                className={`w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 animate-slide-up ${
                  isSelected
                    ? "border-brand-purple bg-brand-purple/5 shadow-md scale-[1.01]"
                    : "border-border hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">{option.approach}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 bg-brand-purple text-white text-[10px] font-bold rounded-full">
                          Selected
                        </span>
                      )}
                      {idx >= 3 && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full">
                          AI Suggestion
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                      {option.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {option.strengths.slice(0, 4).map((s, si) => (
                        <span
                          key={si}
                          className="px-2 py-0.5 bg-accent-green/10 text-accent-green text-[10px] font-medium rounded-full"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    {/* Timeline outline: phase preview */}
                    {"phases" in option && Array.isArray((option as { phases?: unknown }).phases) && (() => {
                      const phases = (option as { phases: Array<{ phaseId: string; title: string; primaryFocus: string; estimatedLessons: number; criterionTags: string[] }> }).phases;
                      return (
                        <div className={`mt-3 pt-3 border-t border-border-default space-y-1.5 ${isSelected ? "animate-slide-up" : ""}`}>
                          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                            Phases <span className="font-normal normal-case">({phases.length} phases)</span>
                          </p>
                          {phases.map((phase) => (
                            <div key={phase.phaseId} className="flex items-center gap-2 text-[11px]">
                              <span className="font-mono text-text-tertiary w-6 flex-shrink-0">{phase.phaseId}</span>
                              <span className="text-text-primary flex-1 truncate">{phase.title}</span>
                              <span className="text-text-tertiary text-[9px] flex-shrink-0">~{phase.estimatedLessons} lessons</span>
                              <div className="flex gap-0.5 flex-shrink-0">
                                {phase.criterionTags.map((tag) => {
                                  const criterion = CRITERIA[tag as keyof typeof CRITERIA];
                                  return criterion ? (
                                    <span
                                      key={tag}
                                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-bold"
                                      style={{ backgroundColor: criterion.color }}
                                    >
                                      {tag}
                                    </span>
                                  ) : (
                                    <span key={tag} className="text-[8px] text-text-tertiary">{tag}</span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Journey outline: lesson plan preview */}
                    {!("phases" in option) && isJourneyOutline && "lessonPlan" in option && (() => {
                      const lessons = (option as { lessonPlan: Array<{ lessonId: string; title: string; primaryFocus: string; criterionTags: string[] }> }).lessonPlan;
                      const previewCount = 3;
                      const visibleLessons = isSelected ? lessons : lessons.slice(0, previewCount);
                      const hasMore = !isSelected && lessons.length > previewCount;

                      return (
                        <div className={`mt-3 pt-3 border-t border-border-default space-y-1.5 ${isSelected ? "animate-slide-up" : "relative"}`}>
                          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                            Lesson Plan {!isSelected && <span className="font-normal normal-case">({lessons.length} lessons)</span>}
                          </p>
                          {visibleLessons.map((lesson) => (
                            <div key={lesson.lessonId} className="flex items-center gap-2 text-[11px]">
                              <span className="font-mono text-text-tertiary w-6 flex-shrink-0">{lesson.lessonId}</span>
                              <span className="text-text-primary flex-1 truncate">{lesson.title}</span>
                              <span className="text-text-tertiary text-[9px] flex-shrink-0">{lesson.primaryFocus}</span>
                              <div className="flex gap-0.5 flex-shrink-0">
                                {lesson.criterionTags.map((tag) => {
                                  const criterion = CRITERIA[tag as keyof typeof CRITERIA];
                                  return criterion ? (
                                    <span
                                      key={tag}
                                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-bold"
                                      style={{ backgroundColor: criterion.color }}
                                    >
                                      {tag}
                                    </span>
                                  ) : (
                                    <span key={tag} className="text-[8px] text-text-tertiary">{tag}</span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          {/* Fade overlay + click hint */}
                          {hasMore && (
                            <>
                              <div className="relative h-6 -mt-4 pointer-events-none" aria-hidden>
                                <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
                              </div>
                              <p className="text-[10px] text-brand-purple font-medium text-center pt-0.5">
                                Click to see all {lessons.length} lessons &darr;
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Suggest skeleton (loading state for new suggestion) */}
          {suggestingIndex !== null && (
            <div className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/30 p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-400 text-white text-sm font-bold flex-shrink-0">
                  {suggestingIndex + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-56 bg-amber-200/60 rounded" />
                  <div className="h-3 w-full bg-amber-100/60 rounded" />
                  <div className="h-3 w-3/4 bg-amber-100/60 rounded" />
                  <p className="text-[10px] text-amber-600 font-medium mt-2">Generating a new approach...</p>
                </div>
              </div>
            </div>
          )}

          {/* Suggest another approach buttons */}
          {showSuggestButtons && suggestingIndex === null && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleSuggest(
                  "A creative, unconventional approach — something surprising that a teacher wouldn't normally think of. Challenge assumptions about how this topic is typically taught."
                )}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-purple-200 rounded-2xl text-xs font-medium text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
                  <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
                </svg>
                Suggest a creative alternative
              </button>
              <button
                onClick={() => handleSuggest(
                  "A proven, practical approach based on what experienced teachers find most effective — prioritise real-world project outcomes, student engagement, and manageable pacing."
                )}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-teal-200 rounded-2xl text-xs font-medium text-teal-600 hover:bg-teal-50 hover:border-teal-300 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="flex-shrink-0">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M5 8l2 2 4-4" />
                </svg>
                Suggest based on what works
              </button>
            </div>
          )}

          <button
            onClick={onGenerateOutlines}
            disabled={outlineStatus === "loading" || suggestingIndex !== null}
            className="w-full py-2 text-xs text-text-secondary/60 hover:text-text-secondary border border-dashed border-border rounded-xl transition disabled:opacity-40"
          >
            Regenerate all options
          </button>
        </div>
      )}
    </div>
  );
}
