"use client";

import { useCallback, useState } from "react";
import type { CriterionKey } from "@/lib/constants";
import type { WizardState, WizardDispatch, WizardMode } from "@/hooks/useWizardState";
import type { Suggestions, SuggestionStatus } from "@/hooks/useWizardSuggestions";
import { GoalInput } from "./GoalInput";
import { GuidedConversation } from "./GuidedConversation";
import { ArchitectForm } from "./ArchitectForm";
import { ApproachPicker } from "./ApproachPicker";
import { GenerationProgress } from "./GenerationProgress";
import { PageCarousel } from "./PageCarousel";
import { JourneyBuilder } from "./JourneyBuilder";
import { TimelineBuilder } from "./TimelineBuilder";
import { DeckBuilder } from "./DeckBuilder";
import { StickyBuildBar } from "./StickyBuildBar";
import { ActivitySidebar } from "./ActivitySidebar";
import { SkeletonReview } from "./SkeletonReview";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  suggestions: Suggestions;
  suggestionStatus: SuggestionStatus;
  onGenerateOutlines: () => void;
  onGenerate: () => void;
  onSave: () => void;
  onRetryCriterion: (criterion: CriterionKey) => void;
  onActivityDrop: (pageId: string, activityId: string) => void;
  onRegeneratePage: (pageId: string) => void;
  onRegenerateActivity?: (activityId: string) => void;
  onGenerateSkeleton?: () => void;
  onBuildFromSkeleton?: () => void;
  onGenerateAdditional?: (angleHint: string) => Promise<void>;
}

export function ConversationWizard({
  state,
  dispatch,
  suggestions,
  suggestionStatus,
  onGenerateOutlines,
  onGenerate,
  onSave,
  onRetryCriterion,
  onActivityDrop,
  onRegeneratePage,
  onRegenerateActivity,
  onGenerateSkeleton,
  onBuildFromSkeleton,
  onGenerateAdditional,
}: Props) {
  const { phase, journeyMode } = state;
  const [timelineView, setTimelineView] = useState<"list" | "deck">("list");

  const handleSelectMode = useCallback(async (mode: WizardMode) => {
    dispatch({ type: "SET_MODE", mode });

    if (mode === "build-for-me") {
      // Fast path: auto-fill everything with AI
      dispatch({ type: "SET_PHASE", phase: "approaches" });
      dispatch({ type: "SET_OUTLINE_STATUS", status: "loading" });

      try {
        // Step 1: Auto-configure all MYP fields
        const selectedKeywords = state.suggestedKeywords
          .filter((k) => k.priority !== "none")
          .map((k) => ({ label: k.label, priority: k.priority }));

        const configRes = await fetch("/api/teacher/wizard-autoconfig", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goalText: journeyMode ? state.journeyInput.endGoal || state.journeyInput.topic : state.input.topic,
            gradeLevel: journeyMode ? state.journeyInput.gradeLevel : state.input.gradeLevel,
            durationWeeks: journeyMode ? state.journeyInput.durationWeeks : state.input.durationWeeks,
            keywords: selectedKeywords.map((k) => k.label),
            keywordPriorities: selectedKeywords,
            journeyMode,
          }),
        });

        const configData = await configRes.json();
        const config = configData.config || {};

        if (journeyMode) {
          // Journey mode: apply config to journeyInput
          const updates: Partial<typeof state.journeyInput> = {};
          if (config.title) updates.title = config.title;
          if (config.topic) updates.topic = config.topic;
          if (config.globalContext) updates.globalContext = config.globalContext;
          if (config.keyConcept) updates.keyConcept = config.keyConcept;
          if (config.relatedConcepts) updates.relatedConcepts = config.relatedConcepts;
          if (config.statementOfInquiry) updates.statementOfInquiry = config.statementOfInquiry;
          if (config.atlSkills) updates.atlSkills = config.atlSkills;
          if (config.specificSkills) updates.specificSkills = config.specificSkills;
          if (!updates.title) updates.title = (state.journeyInput.endGoal || state.journeyInput.topic).slice(0, 60);
          dispatch({ type: "BULK_SET_JOURNEY_INPUT", values: updates });
        } else {
          // Criterion mode: apply config to input
          const updates: Partial<typeof state.input> = {};
          if (config.title) updates.title = config.title;
          if (config.topic) updates.topic = config.topic;
          if (config.globalContext) updates.globalContext = config.globalContext;
          if (config.keyConcept) updates.keyConcept = config.keyConcept;
          if (config.relatedConcepts) updates.relatedConcepts = config.relatedConcepts;
          if (config.statementOfInquiry) updates.statementOfInquiry = config.statementOfInquiry;
          if (config.selectedCriteria) updates.selectedCriteria = config.selectedCriteria;
          if (config.criteriaFocus) updates.criteriaFocus = config.criteriaFocus;
          if (config.atlSkills) updates.atlSkills = config.atlSkills;
          if (config.specificSkills) updates.specificSkills = config.specificSkills;
          if (!updates.title) updates.title = state.input.topic.slice(0, 60);
          dispatch({ type: "BULK_SET_INPUT", values: updates });
        }

        // Step 2: Generate outlines (the parent callback already handles journey vs criterion)
        onGenerateOutlines();
      } catch (err) {
        dispatch({
          type: "SET_OUTLINE_STATUS",
          status: "error",
          error: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    } else if (mode === "architect") {
      // Architect: enter the architect form
      dispatch({ type: "SET_PHASE", phase: "architect" });
    } else {
      // Guide Me: enter guided conversation
      dispatch({ type: "SET_PHASE", phase: "guided" });
    }
  }, [dispatch, state.input, state.journeyInput, state.suggestedKeywords, journeyMode, onGenerateOutlines]);

  // Detect timeline mode (v4) vs journey mode (v3) based on selected outline type
  const isTimelineMode = journeyMode && state.selectedTimelineOutline !== null;

  const handleBuild = useCallback(() => {
    // Timeline mode: go through skeleton step first
    if (isTimelineMode && onGenerateSkeleton) {
      onGenerateSkeleton();
      return;
    }
    dispatch({ type: "SET_PHASE", phase: "generating" });
    onGenerate();
  }, [dispatch, onGenerate, isTimelineMode, onGenerateSkeleton]);

  const handleRegenerate = useCallback(() => {
    if (isTimelineMode) {
      dispatch({ type: "CLEAR_TIMELINE_GENERATION" });
    } else if (journeyMode) {
      dispatch({ type: "CLEAR_JOURNEY_GENERATION" });
    } else {
      dispatch({ type: "CLEAR_GENERATION" });
    }
    dispatch({ type: "SET_PHASE", phase: "approaches" });
  }, [dispatch, journeyMode, isTimelineMode]);

  // Check if generation is complete
  const allDone = isTimelineMode
    ? (state.lessonGenerationStatuses.length > 0 && state.lessonGenerationStatuses.every(s => s.status === "done"))
      || (state.timelinePhaseStatuses.length > 0 && state.timelinePhaseStatuses.every(p => p.status === "done"))
    : journeyMode
      ? state.generationBatches.length > 0 && state.generationBatches.every(b => b.status === "done")
      : state.input.selectedCriteria.every((k) => state.criterionStatus[k] === "done");
  const hasContent = isTimelineMode
    ? state.timelineActivities.length > 0
    : Object.keys(state.generatedPages).length > 0;

  // Auto-transition to review when generation completes
  if (phase === "generating" && allDone && hasContent) {
    Promise.resolve().then(() => dispatch({ type: "SET_PHASE", phase: "review" }));
  }

  // Auto-generate outlines when guided or architect flow completes and reaches approaches phase
  if (phase === "approaches" && state.outlineStatus === "idle" && (state.mode === "guide-me" || state.mode === "architect")) {
    Promise.resolve().then(() => onGenerateOutlines());
  }

  // Show activity sidebar when pages are visible (not for timeline mode — activities are inline)
  const showSidebar = !isTimelineMode && (phase === "review" || (phase === "generating" && hasContent));

  // Can build check
  const canBuild = isTimelineMode
    ? state.selectedTimelineOutline !== null
    : journeyMode
      ? state.selectedJourneyOutline !== null
      : state.selectedOutline !== null;

  return (
    <div className="pb-24">
      {/* Phase: Goal Input (unified screen with config + mode selector) */}
      {(phase === "goal" || phase === "configure") && (
        <GoalInput state={state} dispatch={dispatch} onSelectMode={handleSelectMode} />
      )}

      {/* Phase: Guided Conversation */}
      {phase === "guided" && (
        <GuidedConversation
          state={state}
          dispatch={dispatch}
          suggestions={suggestions}
          suggestionStatus={suggestionStatus}
        />
      )}

      {/* Phase: Architect Form */}
      {phase === "architect" && (
        <ArchitectForm
          state={state}
          dispatch={dispatch}
          onGenerate={() => {
            dispatch({ type: "SET_PHASE", phase: "approaches" });
            onGenerateOutlines();
          }}
        />
      )}

      {/* Phase: Approach Selection */}
      {phase === "approaches" && (
        <ApproachPicker
          state={state}
          dispatch={dispatch}
          onGenerateOutlines={onGenerateOutlines}
          onGenerateAdditional={onGenerateAdditional}
        />
      )}

      {/* Phase: Skeleton Review (two-stage generation) */}
      {phase === "skeleton" && (
        <SkeletonReview
          state={state}
          dispatch={dispatch}
          onBuildActivities={onBuildFromSkeleton || (() => {})}
          onBack={() => {
            dispatch({ type: "SET_SKELETON_STATUS", status: "idle" });
            dispatch({ type: "SET_PHASE", phase: "approaches" });
          }}
        />
      )}

      {/* Timeline mode (v4): continuous activity stream */}
      {isTimelineMode && (phase === "generating" || phase === "review") && (
        <>
          {/* View toggle — list vs deck */}
          {(phase === "review" || (phase === "generating" && state.timelineActivities.length > 0)) && (
            <div className="flex items-center justify-end gap-1 mb-3 max-w-4xl mx-auto">
              <span className="text-[10px] text-text-tertiary mr-1">View:</span>
              <button
                onClick={() => setTimelineView("list")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  timelineView === "list"
                    ? "bg-brand-purple/10 text-brand-purple"
                    : "text-text-tertiary hover:text-text-secondary hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  List
                </span>
              </button>
              <button
                onClick={() => setTimelineView("deck")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  timelineView === "deck"
                    ? "bg-brand-purple/10 text-brand-purple"
                    : "text-text-tertiary hover:text-text-secondary hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="8" height="10" rx="1" /><rect x="14" y="3" width="8" height="10" rx="1" />
                    <rect x="2" y="16" width="8" height="5" rx="1" /><rect x="14" y="16" width="8" height="5" rx="1" />
                  </svg>
                  Deck
                </span>
              </button>
            </div>
          )}

          {timelineView === "deck" ? (
            <DeckBuilder
              state={state}
              dispatch={dispatch}
              onRegenerateActivity={onRegenerateActivity}
            />
          ) : (
            <TimelineBuilder
              state={state}
              dispatch={dispatch}
              onRegenerateActivity={onRegenerateActivity}
            />
          )}
        </>
      )}

      {/* Journey mode (v3): lesson-based builder */}
      {journeyMode && !isTimelineMode && (phase === "generating" || phase === "review") && (
        <JourneyBuilder
          state={state}
          dispatch={dispatch}
          onActivityDrop={onActivityDrop}
          onRegeneratePage={onRegeneratePage}
        />
      )}

      {/* Criterion mode: existing generation + review flow */}
      {!journeyMode && phase === "generating" && (
        <>
          <GenerationProgress
            journeyMode={false}
            selectedCriteria={state.input.selectedCriteria}
            criterionStatus={state.criterionStatus}
            generationBatches={state.generationBatches}
            error={state.error}
            onRetryCriterion={onRetryCriterion}
          />
          {hasContent && (
            <div className="mt-6 animate-slide-up">
              <PageCarousel
                state={state}
                dispatch={dispatch}
                onActivityDrop={onActivityDrop}
                onRegeneratePage={onRegeneratePage}
              />
            </div>
          )}
        </>
      )}

      {!journeyMode && phase === "review" && (
        <PageCarousel
          state={state}
          dispatch={dispatch}
          onActivityDrop={onActivityDrop}
          onRegeneratePage={onRegeneratePage}
        />
      )}

      {/* Floating activity sidebar */}
      {showSidebar && (
        <ActivitySidebar generatedPages={state.generatedPages} />
      )}

      {/* Sticky bottom bar */}
      <StickyBuildBar
        phase={phase}
        canBuild={canBuild}
        saving={state.saving}
        onBuild={handleBuild}
        onSave={onSave}
        onRegenerate={handleRegenerate}
      />
    </div>
  );
}
