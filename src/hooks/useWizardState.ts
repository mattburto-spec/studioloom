import { useReducer } from "react";
import type { UnitWizardInput, PageContent, LessonJourneyInput, JourneyOutlineOption, TimelineActivity, ComputedLesson, TimelineOutlineOption, TimelineSkeleton, TimelineLessonSkeleton } from "@/types";
import type { QualityReport } from "@/types/lesson-intelligence";
import type { CriterionKey } from "@/lib/constants";
import { computeLessonBoundaries } from "@/lib/timeline";

export interface OutlineOption {
  approach: string;
  description: string;
  strengths: string[];
  pages: Record<string, { title: string; summary: string }>;
}

export type GenerationStatus = "idle" | "generating" | "done" | "error";

// --- Conversational wizard types ---

export type WizardPhase = "goal" | "configure" | "guided" | "approaches" | "skeleton" | "generating" | "review";
export type WizardMode = "undecided" | "build-for-me" | "guide-me";

export type KeywordCategory = "skill" | "context" | "topic" | "concept" | "activity" | "groupwork" | "tool" | "resource";

export type KeywordPriority = "none" | "included" | "essential";

export interface SuggestedKeyword {
  label: string;
  category: KeywordCategory;
  priority: KeywordPriority;
}

export interface ConversationTurn {
  id: string;
  question: string;
  field: string;
  options: Array<{ label: string; value: string; description?: string }>;
  answer: string | string[] | null;
  status: "active" | "answered" | "skipped";
}

export interface WizardState {
  // Conversational flow
  phase: WizardPhase;
  mode: WizardMode;
  suggestedKeywords: SuggestedKeyword[];
  conversationTurns: ConversationTurn[];
  currentTurnIndex: number;
  // Core input
  input: UnitWizardInput;
  // Criteria emphasis (0-100, maps to light/standard/emphasis)
  criteriaEmphasis: Record<CriterionKey, number>;
  // Section visibility (kept for guided mode)
  expandedSections: Set<string>;
  // Outline
  outlineOptions: OutlineOption[];
  selectedOutline: number | null;
  outlineStatus: "idle" | "loading" | "done" | "error";
  outlineError: string;
  // Generation
  generatedPages: Partial<Record<string, PageContent>>;
  criterionStatus: Partial<Record<CriterionKey, GenerationStatus>>;
  streamingText: string;
  streamingCriterion: CriterionKey | null;
  // Review
  expandedPages: Set<string>;
  // Save
  saving: boolean;
  // Errors
  error: string;
  warnings: string[];
  // Activity browser
  activityBrowserOpen: boolean;
  activityBrowserPage: string | null;
  // --- Journey mode ---
  journeyMode: boolean;
  journeyInput: LessonJourneyInput;
  totalLessons: number;
  generationBatches: Array<{ lessonIds: string[]; status: GenerationStatus }>;
  journeyOutlineOptions: JourneyOutlineOption[];
  selectedJourneyOutline: number | null;
  revealedLessons: string[];
  // --- Timeline mode (v4) ---
  timelineActivities: TimelineActivity[];
  computedLessons: ComputedLesson[];
  timelineOutlineOptions: TimelineOutlineOption[];
  selectedTimelineOutline: number | null;
  timelinePhaseStatuses: Array<{ phaseId: string; status: GenerationStatus }>;
  revealedActivities: string[];
  draggedActivityId: string | null;
  regeneratingActivityId: string | null;
  // --- Skeleton (two-stage generation) ---
  timelineSkeleton: TimelineSkeleton | null;
  skeletonStatus: "idle" | "loading" | "done" | "error";
  lessonGenerationStatuses: Array<{ lessonId: string; status: GenerationStatus }>;
  // --- Quality evaluation (Layer 4) ---
  qualityReport: QualityReport | null;
  qualityReportStatus: "idle" | "loading" | "done" | "error";
  // --- RAG chunk tracking (Layer 2) ---
  ragChunkIds: string[];
}

type Action =
  // Conversational flow actions
  | { type: "SET_PHASE"; phase: WizardPhase }
  | { type: "SET_MODE"; mode: WizardMode }
  | { type: "SET_KEYWORDS"; keywords: SuggestedKeyword[] }
  | { type: "TOGGLE_KEYWORD"; index: number }
  | { type: "SET_KEYWORD_PRIORITY"; index: number; priority: KeywordPriority }
  | { type: "BULK_SET_INPUT"; values: Partial<UnitWizardInput> }
  | { type: "SET_TURNS"; turns: ConversationTurn[] }
  | { type: "ANSWER_TURN"; turnId: string; answer: string | string[] }
  | { type: "SKIP_TURN"; turnId: string }
  | { type: "ADVANCE_TURN" }
  // Existing actions
  | { type: "SET_INPUT"; key: keyof UnitWizardInput; value: unknown }
  | { type: "TOGGLE_ARRAY_ITEM"; key: "relatedConcepts" | "atlSkills" | "specificSkills"; item: string }
  | { type: "SET_EMPHASIS"; criterion: CriterionKey; value: number }
  | { type: "TOGGLE_SECTION"; section: string }
  | { type: "EXPAND_SECTION"; section: string }
  | { type: "SET_OUTLINES"; options: OutlineOption[] }
  | { type: "SELECT_OUTLINE"; index: number | null }
  | { type: "SET_OUTLINE_STATUS"; status: WizardState["outlineStatus"]; error?: string }
  | { type: "SET_PAGES"; pages: Partial<Record<string, PageContent>> }
  | { type: "MERGE_PAGES"; pages: Partial<Record<string, PageContent>> }
  | { type: "SET_CRITERION_STATUS"; criterion: CriterionKey; status: GenerationStatus }
  | { type: "SET_STREAMING"; text: string; criterion: CriterionKey | null }
  | { type: "TOGGLE_EXPANDED_PAGE"; pageId: string }
  | { type: "DELETE_SECTION"; pageId: string; sectionIndex: number }
  | { type: "ADD_SECTION"; pageId: string }
  | { type: "REORDER_SECTIONS"; pageId: string; fromIndex: number; toIndex: number }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "SET_ERROR"; error: string }
  | { type: "ADD_WARNINGS"; warnings: string[] }
  | { type: "CLEAR_GENERATION" }
  | { type: "TOGGLE_CRITERION"; criterion: CriterionKey }
  | { type: "SET_ACTIVITY_BROWSER"; open: boolean; pageId?: string | null }
  | { type: "UPDATE_PAGE"; pageId: string; page: PageContent }
  // Journey mode actions
  | { type: "SET_JOURNEY_MODE"; enabled: boolean }
  | { type: "SET_JOURNEY_INPUT"; key: keyof LessonJourneyInput; value: unknown }
  | { type: "BULK_SET_JOURNEY_INPUT"; values: Partial<LessonJourneyInput> }
  | { type: "SET_JOURNEY_OUTLINES"; options: JourneyOutlineOption[] }
  | { type: "APPEND_JOURNEY_OUTLINE"; option: JourneyOutlineOption; index: number }
  | { type: "SELECT_JOURNEY_OUTLINE"; index: number | null }
  | { type: "SET_BATCH_STATUS"; batchIndex: number; status: GenerationStatus }
  | { type: "INIT_JOURNEY_BATCHES" }
  | { type: "CLEAR_JOURNEY_GENERATION" }
  | { type: "REVEAL_LESSON"; lessonId: string }
  | { type: "REVEAL_ALL_LESSONS" }
  // Timeline mode (v4) actions
  | { type: "SET_TIMELINE"; activities: TimelineActivity[] }
  | { type: "MERGE_TIMELINE"; activities: TimelineActivity[] }
  | { type: "REORDER_ACTIVITY"; fromIndex: number; toIndex: number }
  | { type: "UPDATE_ACTIVITY"; activityId: string; updates: Partial<TimelineActivity> }
  | { type: "DELETE_ACTIVITY"; activityId: string }
  | { type: "INSERT_ACTIVITY"; afterIndex: number; activity: TimelineActivity }
  | { type: "SET_TIMELINE_OUTLINES"; options: TimelineOutlineOption[] }
  | { type: "APPEND_TIMELINE_OUTLINE"; option: TimelineOutlineOption; index: number }
  | { type: "SELECT_TIMELINE_OUTLINE"; index: number | null }
  | { type: "SET_TIMELINE_PHASE_STATUS"; phaseId: string; status: GenerationStatus }
  | { type: "INIT_TIMELINE_PHASES" }
  | { type: "CLEAR_TIMELINE_GENERATION" }
  | { type: "REVEAL_ACTIVITY"; activityId: string }
  | { type: "REVEAL_ALL_ACTIVITIES" }
  | { type: "SET_DRAGGED_ACTIVITY"; activityId: string | null }
  | { type: "SET_REGENERATING_ACTIVITY"; activityId: string | null }
  | { type: "REPLACE_ACTIVITY"; activityId: string; activity: TimelineActivity }
  // Skeleton (two-stage generation) actions
  | { type: "SET_SKELETON"; skeleton: TimelineSkeleton }
  | { type: "SET_SKELETON_STATUS"; status: WizardState["skeletonStatus"] }
  | { type: "UPDATE_SKELETON_LESSON"; lessonId: string; updates: Partial<TimelineLessonSkeleton> }
  | { type: "REORDER_SKELETON_LESSON"; fromIndex: number; toIndex: number }
  | { type: "DELETE_SKELETON_LESSON"; lessonId: string }
  | { type: "INSERT_SKELETON_LESSON"; afterIndex: number; lesson: TimelineLessonSkeleton }
  | { type: "INIT_LESSON_GENERATION" }
  | { type: "SET_LESSON_GENERATION_STATUS"; lessonId: string; status: GenerationStatus }
  // Quality evaluation actions
  | { type: "SET_QUALITY_REPORT"; report: QualityReport }
  | { type: "SET_QUALITY_REPORT_STATUS"; status: WizardState["qualityReportStatus"] }
  // RAG chunk tracking
  | { type: "ADD_RAG_CHUNK_IDS"; ids: string[] };

function emphasisToFocus(value: number): "light" | "standard" | "emphasis" {
  if (value <= 33) return "light";
  if (value <= 66) return "standard";
  return "emphasis";
}

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    // --- Conversational flow ---
    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SET_MODE":
      return { ...state, mode: action.mode };

    case "SET_KEYWORDS":
      return { ...state, suggestedKeywords: action.keywords };

    case "TOGGLE_KEYWORD": {
      const keywords = [...state.suggestedKeywords];
      if (keywords[action.index]) {
        const current = keywords[action.index].priority;
        const next: KeywordPriority =
          current === "none" ? "included" : current === "included" ? "essential" : "none";
        keywords[action.index] = { ...keywords[action.index], priority: next };
      }
      return { ...state, suggestedKeywords: keywords };
    }

    case "SET_KEYWORD_PRIORITY": {
      const keywords = [...state.suggestedKeywords];
      if (keywords[action.index]) {
        keywords[action.index] = { ...keywords[action.index], priority: action.priority };
      }
      return { ...state, suggestedKeywords: keywords };
    }

    case "BULK_SET_INPUT":
      return {
        ...state,
        input: { ...state.input, ...action.values },
      };

    case "SET_TURNS":
      return { ...state, conversationTurns: action.turns, currentTurnIndex: 0 };

    case "ANSWER_TURN": {
      const turns = state.conversationTurns.map((t) =>
        t.id === action.turnId ? { ...t, answer: action.answer, status: "answered" as const } : t
      );
      return { ...state, conversationTurns: turns };
    }

    case "SKIP_TURN": {
      const turns = state.conversationTurns.map((t) =>
        t.id === action.turnId ? { ...t, status: "skipped" as const } : t
      );
      return { ...state, conversationTurns: turns };
    }

    case "ADVANCE_TURN": {
      const nextIndex = state.currentTurnIndex + 1;
      if (nextIndex < state.conversationTurns.length) {
        const turns = state.conversationTurns.map((t, i) =>
          i === nextIndex ? { ...t, status: "active" as const } : t
        );
        return { ...state, conversationTurns: turns, currentTurnIndex: nextIndex };
      }
      // All turns done — advance to approaches phase
      return { ...state, phase: "approaches", currentTurnIndex: nextIndex };
    }

    // --- Existing actions ---
    case "SET_INPUT": {
      const newState = {
        ...state,
        input: { ...state.input, [action.key]: action.value },
      };
      // Keep journey input in sync with shared fields
      if (state.journeyMode) {
        const sharedKeys: Array<keyof typeof state.journeyInput> = [
          "title", "gradeLevel", "topic", "globalContext", "keyConcept",
          "statementOfInquiry", "specialRequirements",
        ];
        if (sharedKeys.includes(action.key as keyof typeof state.journeyInput)) {
          newState.journeyInput = { ...newState.journeyInput, [action.key]: action.value };
        }
        // Keep endGoal synced with topic (the textarea IS the end goal in journey mode)
        if (action.key === "topic") {
          newState.journeyInput = { ...newState.journeyInput, endGoal: action.value as string };
        }
        // Recalculate totalLessons when durationWeeks changes
        if (action.key === "durationWeeks") {
          newState.journeyInput = { ...newState.journeyInput, durationWeeks: action.value as number };
          newState.totalLessons = (action.value as number) * newState.journeyInput.lessonsPerWeek;
        }
      }
      return newState;
    }

    case "TOGGLE_ARRAY_ITEM": {
      const arr = state.input[action.key] as string[];
      const newArr = arr.includes(action.item)
        ? arr.filter((x) => x !== action.item)
        : [...arr, action.item];
      return {
        ...state,
        input: { ...state.input, [action.key]: newArr },
      };
    }

    case "SET_EMPHASIS": {
      const newEmphasis = { ...state.criteriaEmphasis, [action.criterion]: action.value };
      return {
        ...state,
        criteriaEmphasis: newEmphasis,
        input: {
          ...state.input,
          criteriaFocus: {
            ...state.input.criteriaFocus,
            [action.criterion]: emphasisToFocus(action.value),
          },
        },
      };
    }

    case "TOGGLE_SECTION": {
      const next = new Set(state.expandedSections);
      if (next.has(action.section)) {
        next.delete(action.section);
      } else {
        next.add(action.section);
      }
      return { ...state, expandedSections: next };
    }

    case "EXPAND_SECTION": {
      if (state.expandedSections.has(action.section)) return state;
      const next = new Set(state.expandedSections);
      next.add(action.section);
      return { ...state, expandedSections: next };
    }

    case "SET_OUTLINES":
      return { ...state, outlineOptions: action.options, outlineStatus: "done" };

    case "SELECT_OUTLINE":
      return { ...state, selectedOutline: action.index };

    case "SET_OUTLINE_STATUS":
      return {
        ...state,
        outlineStatus: action.status,
        outlineError: action.error || "",
      };

    case "SET_PAGES":
      return { ...state, generatedPages: action.pages };

    case "MERGE_PAGES":
      return {
        ...state,
        generatedPages: { ...state.generatedPages, ...action.pages },
      };

    case "SET_CRITERION_STATUS":
      return {
        ...state,
        criterionStatus: { ...state.criterionStatus, [action.criterion]: action.status },
      };

    case "SET_STREAMING":
      return {
        ...state,
        streamingText: action.text,
        streamingCriterion: action.criterion,
      };

    case "TOGGLE_EXPANDED_PAGE": {
      const next = new Set(state.expandedPages);
      if (next.has(action.pageId)) {
        next.delete(action.pageId);
      } else {
        next.add(action.pageId);
      }
      return { ...state, expandedPages: next };
    }

    case "DELETE_SECTION": {
      const page = state.generatedPages[action.pageId];
      if (!page || page.sections.length <= 1) return state; // keep at least 1 section
      const newSections = page.sections.filter((_, i) => i !== action.sectionIndex);
      return {
        ...state,
        generatedPages: {
          ...state.generatedPages,
          [action.pageId]: { ...page, sections: newSections },
        },
      };
    }

    case "ADD_SECTION": {
      const page = state.generatedPages[action.pageId];
      if (!page) return state;
      const newSection = { prompt: "", responseType: "text" as const };
      return {
        ...state,
        generatedPages: {
          ...state.generatedPages,
          [action.pageId]: { ...page, sections: [...page.sections, newSection] },
        },
      };
    }

    case "REORDER_SECTIONS": {
      const page = state.generatedPages[action.pageId];
      if (!page) return state;
      const sections = [...page.sections];
      const { fromIndex, toIndex } = action;
      if (fromIndex < 0 || fromIndex >= sections.length || toIndex < 0 || toIndex >= sections.length) return state;
      const [moved] = sections.splice(fromIndex, 1);
      sections.splice(toIndex, 0, moved);
      return {
        ...state,
        generatedPages: {
          ...state.generatedPages,
          [action.pageId]: { ...page, sections },
        },
      };
    }

    case "SET_SAVING":
      return { ...state, saving: action.saving };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "ADD_WARNINGS":
      return { ...state, warnings: [...state.warnings, ...action.warnings] };

    case "CLEAR_GENERATION": {
      const resetStatus: Partial<Record<CriterionKey, GenerationStatus>> = {};
      for (const c of state.input.selectedCriteria) {
        resetStatus[c] = "idle";
      }
      return {
        ...state,
        generatedPages: {},
        criterionStatus: resetStatus,
        streamingText: "",
        streamingCriterion: null,
        error: "",
        warnings: [],
      };
    }

    case "TOGGLE_CRITERION": {
      const current = state.input.selectedCriteria;
      const isSelected = current.includes(action.criterion);
      if (isSelected && current.length <= 1) return state; // must keep at least 1
      const newSelected = isSelected
        ? current.filter(c => c !== action.criterion)
        : [...current, action.criterion].sort() as CriterionKey[];
      const newFocus = { ...state.input.criteriaFocus };
      if (isSelected) {
        delete newFocus[action.criterion];
      } else {
        newFocus[action.criterion] = "standard";
      }
      return {
        ...state,
        input: {
          ...state.input,
          selectedCriteria: newSelected,
          criteriaFocus: newFocus,
        },
      };
    }

    case "SET_ACTIVITY_BROWSER":
      return {
        ...state,
        activityBrowserOpen: action.open,
        activityBrowserPage: action.pageId ?? null,
      };

    case "UPDATE_PAGE":
      return {
        ...state,
        generatedPages: { ...state.generatedPages, [action.pageId]: action.page },
      };

    // --- Journey mode ---

    case "SET_JOURNEY_MODE": {
      const totalLessons = state.journeyInput.durationWeeks * state.journeyInput.lessonsPerWeek;
      // Sync existing topic to endGoal when enabling journey mode (if endGoal is empty)
      const ji = state.journeyInput;
      const syncedInput = action.enabled && !ji.endGoal && state.input.topic
        ? { ...ji, endGoal: state.input.topic }
        : ji;
      return { ...state, journeyMode: action.enabled, journeyInput: syncedInput, totalLessons };
    }

    case "SET_JOURNEY_INPUT": {
      const newInput = { ...state.journeyInput, [action.key]: action.value };
      const totalLessons = newInput.durationWeeks * newInput.lessonsPerWeek;
      return { ...state, journeyInput: newInput, totalLessons };
    }

    case "BULK_SET_JOURNEY_INPUT": {
      const newInput = { ...state.journeyInput, ...action.values };
      const totalLessons = newInput.durationWeeks * newInput.lessonsPerWeek;
      return { ...state, journeyInput: newInput, totalLessons };
    }

    case "SET_JOURNEY_OUTLINES":
      return { ...state, journeyOutlineOptions: action.options, outlineStatus: "done" };

    case "APPEND_JOURNEY_OUTLINE": {
      const options = [...state.journeyOutlineOptions];
      options[action.index] = action.option;
      const filledCount = options.filter(Boolean).length;
      return {
        ...state,
        journeyOutlineOptions: options,
        outlineStatus: filledCount >= 3 ? "done" : "loading",
      };
    }

    case "SELECT_JOURNEY_OUTLINE":
      return { ...state, selectedJourneyOutline: action.index };

    case "SET_BATCH_STATUS": {
      const batches = [...state.generationBatches];
      if (batches[action.batchIndex]) {
        batches[action.batchIndex] = { ...batches[action.batchIndex], status: action.status };
      }
      return { ...state, generationBatches: batches };
    }

    case "INIT_JOURNEY_BATCHES": {
      const total = state.totalLessons;
      const batchSize = 6;
      const batches: Array<{ lessonIds: string[]; status: GenerationStatus }> = [];
      for (let i = 0; i < total; i += batchSize) {
        const count = Math.min(batchSize, total - i);
        const lessonIds = Array.from({ length: count }, (_, j) =>
          `L${String(i + j + 1).padStart(2, "0")}`
        );
        batches.push({ lessonIds, status: "idle" });
      }
      return { ...state, generationBatches: batches };
    }

    case "CLEAR_JOURNEY_GENERATION":
      return {
        ...state,
        generatedPages: {},
        generationBatches: state.generationBatches.map((b) => ({ ...b, status: "idle" as const })),
        streamingText: "",
        error: "",
        warnings: [],
        revealedLessons: [],
      };

    case "REVEAL_LESSON":
      return {
        ...state,
        revealedLessons: state.revealedLessons.includes(action.lessonId)
          ? state.revealedLessons
          : [...state.revealedLessons, action.lessonId],
      };

    case "REVEAL_ALL_LESSONS":
      return {
        ...state,
        revealedLessons: Object.keys(state.generatedPages).filter(id => id.startsWith("L")).sort(),
      };

    // --- Timeline mode (v4) ---

    case "SET_TIMELINE": {
      const lessons = computeLessonBoundaries(action.activities, state.journeyInput.lessonLengthMinutes);
      return { ...state, timelineActivities: action.activities, computedLessons: lessons };
    }

    case "MERGE_TIMELINE": {
      const merged = [...state.timelineActivities, ...action.activities];
      const lessons = computeLessonBoundaries(merged, state.journeyInput.lessonLengthMinutes);
      return { ...state, timelineActivities: merged, computedLessons: lessons };
    }

    case "REORDER_ACTIVITY": {
      const activities = [...state.timelineActivities];
      const { fromIndex, toIndex } = action;
      if (fromIndex < 0 || fromIndex >= activities.length || toIndex < 0 || toIndex >= activities.length) return state;
      const [moved] = activities.splice(fromIndex, 1);
      activities.splice(toIndex, 0, moved);
      const lessons = computeLessonBoundaries(activities, state.journeyInput.lessonLengthMinutes);
      return { ...state, timelineActivities: activities, computedLessons: lessons };
    }

    case "UPDATE_ACTIVITY": {
      const activities = state.timelineActivities.map((a) =>
        a.id === action.activityId ? { ...a, ...action.updates } : a
      );
      const lessons = computeLessonBoundaries(activities, state.journeyInput.lessonLengthMinutes);
      return { ...state, timelineActivities: activities, computedLessons: lessons };
    }

    case "DELETE_ACTIVITY": {
      const activities = state.timelineActivities.filter((a) => a.id !== action.activityId);
      const lessons = computeLessonBoundaries(activities, state.journeyInput.lessonLengthMinutes);
      return { ...state, timelineActivities: activities, computedLessons: lessons };
    }

    case "INSERT_ACTIVITY": {
      const activities = [...state.timelineActivities];
      activities.splice(action.afterIndex + 1, 0, action.activity);
      const lessons = computeLessonBoundaries(activities, state.journeyInput.lessonLengthMinutes);
      return { ...state, timelineActivities: activities, computedLessons: lessons };
    }

    case "SET_TIMELINE_OUTLINES":
      return { ...state, timelineOutlineOptions: action.options, outlineStatus: "done" };

    case "APPEND_TIMELINE_OUTLINE": {
      const options = [...state.timelineOutlineOptions];
      options[action.index] = action.option;
      // Mark as done once at least 3 slots are filled (supports additional suggestions)
      const filledCount = options.filter(Boolean).length;
      return {
        ...state,
        timelineOutlineOptions: options,
        outlineStatus: filledCount >= 3 ? "done" : state.outlineStatus === "done" ? "done" : "loading",
      };
    }

    case "SELECT_TIMELINE_OUTLINE":
      return { ...state, selectedTimelineOutline: action.index };

    case "SET_TIMELINE_PHASE_STATUS": {
      const phases = state.timelinePhaseStatuses.map((p) =>
        p.phaseId === action.phaseId ? { ...p, status: action.status } : p
      );
      return { ...state, timelinePhaseStatuses: phases };
    }

    case "INIT_TIMELINE_PHASES": {
      const outline = state.selectedTimelineOutline !== null
        ? state.timelineOutlineOptions[state.selectedTimelineOutline]
        : null;
      if (!outline) return state;
      const phases = outline.phases.map((p) => ({
        phaseId: p.phaseId,
        status: "idle" as GenerationStatus,
      }));
      return { ...state, timelinePhaseStatuses: phases };
    }

    case "CLEAR_TIMELINE_GENERATION":
      return {
        ...state,
        timelineActivities: [],
        computedLessons: [],
        timelinePhaseStatuses: state.timelinePhaseStatuses.map((p) => ({ ...p, status: "idle" as const })),
        streamingText: "",
        error: "",
        warnings: [],
        revealedActivities: [],
      };

    case "REVEAL_ACTIVITY":
      return {
        ...state,
        revealedActivities: state.revealedActivities.includes(action.activityId)
          ? state.revealedActivities
          : [...state.revealedActivities, action.activityId],
      };

    case "REVEAL_ALL_ACTIVITIES":
      return {
        ...state,
        revealedActivities: state.timelineActivities.map((a) => a.id),
      };

    case "SET_DRAGGED_ACTIVITY":
      return { ...state, draggedActivityId: action.activityId };

    case "SET_REGENERATING_ACTIVITY":
      return { ...state, regeneratingActivityId: action.activityId };

    case "REPLACE_ACTIVITY": {
      const activities = state.timelineActivities.map((a) =>
        a.id === action.activityId ? action.activity : a
      );
      const lessons = computeLessonBoundaries(activities, state.journeyInput.lessonLengthMinutes);
      return { ...state, timelineActivities: activities, computedLessons: lessons, regeneratingActivityId: null };
    }

    // --- Skeleton (two-stage generation) ---

    case "SET_SKELETON":
      return { ...state, timelineSkeleton: action.skeleton, skeletonStatus: "done" };

    case "SET_SKELETON_STATUS":
      return { ...state, skeletonStatus: action.status };

    case "UPDATE_SKELETON_LESSON": {
      if (!state.timelineSkeleton) return state;
      const lessons = state.timelineSkeleton.lessons.map((l) =>
        l.lessonId === action.lessonId ? { ...l, ...action.updates } : l
      );
      return { ...state, timelineSkeleton: { ...state.timelineSkeleton, lessons } };
    }

    case "REORDER_SKELETON_LESSON": {
      if (!state.timelineSkeleton) return state;
      const lessons = [...state.timelineSkeleton.lessons];
      const { fromIndex, toIndex } = action;
      if (fromIndex < 0 || fromIndex >= lessons.length || toIndex < 0 || toIndex >= lessons.length) return state;
      const [moved] = lessons.splice(fromIndex, 1);
      lessons.splice(toIndex, 0, moved);
      // Renumber lessons after reorder
      const renumbered = lessons.map((l, i) => ({
        ...l,
        lessonNumber: i + 1,
        lessonId: `L${String(i + 1).padStart(2, "0")}`,
      }));
      return { ...state, timelineSkeleton: { ...state.timelineSkeleton, lessons: renumbered } };
    }

    case "DELETE_SKELETON_LESSON": {
      if (!state.timelineSkeleton) return state;
      const filtered = state.timelineSkeleton.lessons.filter((l) => l.lessonId !== action.lessonId);
      // Renumber remaining lessons
      const renumbered = filtered.map((l, i) => ({
        ...l,
        lessonNumber: i + 1,
        lessonId: `L${String(i + 1).padStart(2, "0")}`,
      }));
      return { ...state, timelineSkeleton: { ...state.timelineSkeleton, lessons: renumbered } };
    }

    case "INSERT_SKELETON_LESSON": {
      if (!state.timelineSkeleton) return state;
      const lessons = [...state.timelineSkeleton.lessons];
      lessons.splice(action.afterIndex + 1, 0, action.lesson);
      // Renumber all lessons
      const renumbered = lessons.map((l, i) => ({
        ...l,
        lessonNumber: i + 1,
        lessonId: `L${String(i + 1).padStart(2, "0")}`,
      }));
      return { ...state, timelineSkeleton: { ...state.timelineSkeleton, lessons: renumbered } };
    }

    case "INIT_LESSON_GENERATION": {
      if (!state.timelineSkeleton) return state;
      const statuses = state.timelineSkeleton.lessons.map((l) => ({
        lessonId: l.lessonId,
        status: "idle" as GenerationStatus,
      }));
      return { ...state, lessonGenerationStatuses: statuses };
    }

    case "SET_LESSON_GENERATION_STATUS": {
      const statuses = state.lessonGenerationStatuses.map((s) =>
        s.lessonId === action.lessonId ? { ...s, status: action.status } : s
      );
      return { ...state, lessonGenerationStatuses: statuses };
    }

    // --- Quality evaluation ---
    case "SET_QUALITY_REPORT":
      return { ...state, qualityReport: action.report, qualityReportStatus: "done" };

    case "SET_QUALITY_REPORT_STATUS":
      return { ...state, qualityReportStatus: action.status };

    // --- RAG chunk tracking ---
    case "ADD_RAG_CHUNK_IDS": {
      const existing = new Set(state.ragChunkIds);
      const newIds = action.ids.filter((id) => !existing.has(id));
      if (newIds.length === 0) return state;
      return { ...state, ragChunkIds: [...state.ragChunkIds, ...newIds] };
    }

    default:
      return state;
  }
}

const initialState: WizardState = {
  phase: "goal",
  mode: "undecided",
  suggestedKeywords: [],
  conversationTurns: [],
  currentTurnIndex: 0,
  input: {
    title: "",
    gradeLevel: "Year 3 (Grade 8)",
    durationWeeks: 6,
    topic: "",
    globalContext: "",
    keyConcept: "",
    relatedConcepts: [],
    statementOfInquiry: "",
    selectedCriteria: ["A", "B", "C", "D"] as CriterionKey[],
    criteriaFocus: { A: "standard", B: "standard", C: "standard", D: "standard" },
    atlSkills: [],
    specificSkills: [],
    resourceUrls: [],
    specialRequirements: "",
  },
  criteriaEmphasis: { A: 50, B: 50, C: 50, D: 50 },
  expandedSections: new Set(["basics"]),
  outlineOptions: [],
  selectedOutline: null,
  outlineStatus: "idle",
  outlineError: "",
  generatedPages: {},
  criterionStatus: {},
  streamingText: "",
  streamingCriterion: null,
  expandedPages: new Set<string>(),
  saving: false,
  error: "",
  warnings: [],
  activityBrowserOpen: false,
  activityBrowserPage: null,
  // Journey mode
  journeyMode: true,
  journeyInput: {
    title: "",
    gradeLevel: "Year 3 (Grade 8)",
    endGoal: "",
    durationWeeks: 6,
    lessonsPerWeek: 3,
    lessonLengthMinutes: 50,
    topic: "",
    globalContext: "",
    keyConcept: "",
    relatedConcepts: [],
    statementOfInquiry: "",
    atlSkills: [],
    specificSkills: [],
    resourceUrls: [],
    specialRequirements: "",
    assessmentCriteria: ["A", "B", "C", "D"],
  },
  totalLessons: 18,
  generationBatches: [],
  journeyOutlineOptions: [],
  selectedJourneyOutline: null,
  revealedLessons: [],
  // Timeline mode (v4)
  timelineActivities: [],
  computedLessons: [],
  timelineOutlineOptions: [],
  selectedTimelineOutline: null,
  timelinePhaseStatuses: [],
  revealedActivities: [],
  draggedActivityId: null,
  regeneratingActivityId: null,
  // Skeleton (two-stage generation)
  timelineSkeleton: null,
  skeletonStatus: "idle",
  lessonGenerationStatuses: [],
  qualityReport: null,
  qualityReportStatus: "idle",
  ragChunkIds: [],
};

export function useWizardState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return { state, dispatch };
}

export type WizardDispatch = React.Dispatch<Action>;
