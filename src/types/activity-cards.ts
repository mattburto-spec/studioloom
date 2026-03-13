/**
 * Activity Cards system types.
 *
 * Cards are the database-backed evolution of the hardcoded ActivityTemplate[].
 * Each card has rich metadata, AI-generated modifier axes, and usage tracking.
 */

import type { ActivitySection, VocabTerm, Reflection } from "@/types";

// ---------------------------------------------------------------------------
// Category & thinking type unions
// ---------------------------------------------------------------------------

export type ActivityCardCategory =
  | "design-thinking"
  | "visible-thinking"
  | "evaluation"
  | "brainstorming"
  | "analysis"
  | "skills";

export type ThinkingType =
  | "creative"
  | "critical"
  | "analytical"
  | "metacognitive";

export type GroupSize =
  | "individual"
  | "pairs"
  | "small-group"
  | "whole-class"
  | "flexible";

export type CardSource =
  | "system"
  | "teacher"
  | "community"
  | "ai_generated";

// ---------------------------------------------------------------------------
// Modifier axis — each card gets its own AI-generated set
// ---------------------------------------------------------------------------

export interface ModifierOption {
  value: string;
  label: string;
  /** Instruction fragment injected into the AI adaptation prompt */
  promptDelta: string;
}

export interface ModifierAxis {
  id: string;              // e.g. "medium", "collaboration"
  label: string;           // e.g. "Working Medium"
  description: string;     // e.g. "How students capture ideas"
  type: "select" | "toggle";
  options?: ModifierOption[];
  default: string | boolean;
}

// ---------------------------------------------------------------------------
// Template & AI hints (stored as JSONB in database)
// ---------------------------------------------------------------------------

export interface CardTemplate {
  sections: ActivitySection[];
  vocabTerms?: VocabTerm[];
  reflection?: Reflection;
}

export interface CardAIHints {
  whenToUse: string;
  topicAdaptation: string;
  modifierAxes: ModifierAxis[];
}

// ---------------------------------------------------------------------------
// Activity Card — the core entity
// ---------------------------------------------------------------------------

export interface ActivityCard {
  id: string;               // UUID
  slug: string;             // "scamper", "six-thinking-hats"
  name: string;
  description: string;
  category: ActivityCardCategory;
  criteria: string[];
  phases: string[];
  thinking_type: ThinkingType;
  duration_minutes: number;
  group_size: GroupSize;
  materials: string[];
  tools: string[];
  resources_needed: string | null;
  teacher_notes: string | null;
  template: CardTemplate;
  ai_hints: CardAIHints;
  curriculum_frameworks: string[];
  source: CardSource;
  created_by: string | null;
  parent_card_id: string | null;
  times_used: number;
  avg_edit_distance: number | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Usage tracking record
// ---------------------------------------------------------------------------

export interface ActivityCardUsage {
  id: string;
  card_id: string;
  teacher_id: string;
  unit_id: string | null;
  page_id: string | null;
  criterion: string | null;
  modifiers_applied: Record<string, string | boolean> | null;
  custom_prompt: string | null;
  sections_before: ActivitySection[] | null;
  sections_after: ActivitySection[] | null;
  teacher_rating: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Filter parameters for search/list
// ---------------------------------------------------------------------------

export interface ActivityCardFilters {
  category?: ActivityCardCategory;
  criterion?: string;
  thinkingType?: ThinkingType;
  groupSize?: GroupSize;
  maxDuration?: number;
  minDuration?: number;
  source?: CardSource;
  search?: string;
}

// ---------------------------------------------------------------------------
// Apply request — sent when teacher drops a card with modifiers
// ---------------------------------------------------------------------------

export interface ActivityCardApplyRequest {
  cardId: string;
  modifiers?: Record<string, string | boolean>;
  customPrompt?: string;
  context?: {
    unitTopic?: string;
    gradeLevel?: string;
    criterion?: string;
    pageId?: string;
    pageLearningGoal?: string;
    adjacentPageTitles?: string[];
    existingSections?: ActivitySection[];
  };
}

export interface ActivityCardApplyResponse {
  sections: ActivitySection[];
  vocabTerms?: VocabTerm[];
  reflection?: Reflection;
  adaptationNotes?: string;
}

// ---------------------------------------------------------------------------
// Auto-recommendation — AI picks best card + modifiers for each page
// ---------------------------------------------------------------------------

export interface CardRecommendation {
  pageId: string;
  card: ActivityCard;
  suggestedModifiers: Record<string, string | boolean>;
  reason: string;
}

export interface RecommendCardsRequest {
  pages: Record<
    string,
    { title: string; learningGoal: string; sections: Array<{ prompt: string }> }
  >;
  unitContext: {
    topic: string;
    gradeLevel?: string;
  };
}
