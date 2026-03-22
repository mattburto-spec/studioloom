/**
 * Safety Training Content Block Types
 *
 * Rich learning modules replace flat LearnCards.
 * Each block type has its own renderer in src/components/safety/blocks/.
 * Stored as JSONB `learning_blocks` on badges table.
 */

// ============================================================================
// Block Types
// ============================================================================

export interface SpotTheHazardBlock {
  type: "spot_the_hazard";
  id: string;
  title: string;
  scene_id: string; // references SVG scene
  scene_type: "wood" | "metal" | "textiles" | "food" | "digital_fab" | "general" | "custom";
  hazards: Array<{
    id: string;
    zone: { x: number; y: number; width: number; height: number }; // % coordinates (0-100)
    severity: "critical" | "warning" | "minor";
    label: string;
    explanation: string;
    rule_reference?: string;
  }>;
  total_hazards: number;
  time_limit_seconds?: number;
  pass_threshold: number; // e.g. find 6 of 8
}

export interface ScenarioBlock {
  type: "scenario";
  id: string;
  title: string;
  setup: string; // situation description
  illustration?: string; // optional image
  branches: Array<{
    id: string;
    choice_text: string;
    is_correct: boolean;
    feedback: string;
    consequence?: string;
    next_branch_id?: string; // for multi-step
  }>;
}

export interface BeforeAfterBlock {
  type: "before_after";
  id: string;
  title: string;
  before: {
    image?: string;
    caption: string;
    hazards: string[];
  };
  after: {
    image?: string;
    caption: string;
    principles: string[];
  };
  key_difference: string;
}

export interface MachineDiagramBlock {
  type: "machine_diagram";
  id: string;
  title: string;
  machine_image: string;
  labels: Array<{
    id: string;
    text: string;
    correct_position: { x: number; y: number }; // % coordinates
    snap_radius: number;
    description: string;
    safety_note?: string;
  }>;
  mode: "drag_to_place" | "tap_to_identify";
}

export interface MicroStoryBlock {
  type: "micro_story";
  id: string;
  title: string;
  narrative: string;
  is_real_incident: boolean;
  analysis_prompts: Array<{
    question: string;
    reveal_answer: string;
  }>;
  key_lesson: string;
  related_rule?: string;
}

export interface KeyConceptBlock {
  type: "key_concept";
  id: string;
  title: string;
  icon: string;
  content: string; // supports markdown
  tips?: string[];
  examples?: string[];
  warning?: string;
  image?: string;
}

export interface ComprehensionCheckBlock {
  type: "comprehension_check";
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  feedback_correct: string;
  feedback_wrong: string;
  hint?: string;
}

export interface StepByStepBlock {
  type: "step_by_step";
  id: string;
  title: string;
  steps: Array<{
    number: number;
    instruction: string;
    image?: string;
    warning?: string;
    checkpoint?: string;
  }>;
}

export interface VideoEmbedBlock {
  type: "video_embed";
  id: string;
  title: string;
  url: string; // YouTube/Vimeo
  start_time?: number; // seconds
  end_time?: number;
  caption?: string;
}

// Union type
export type ContentBlock =
  | SpotTheHazardBlock
  | ScenarioBlock
  | BeforeAfterBlock
  | MachineDiagramBlock
  | MicroStoryBlock
  | KeyConceptBlock
  | ComprehensionCheckBlock
  | StepByStepBlock
  | VideoEmbedBlock;

// ============================================================================
// Learning Module
// ============================================================================

export interface LearningModule {
  badge_id: string;
  learning_objectives: string[];
  estimated_minutes: number;
  blocks: ContentBlock[];
}

// ============================================================================
// Teacher Guide
// ============================================================================

export interface TeacherGuide {
  badge_id: string;
  estimated_lesson_minutes: number;
  demo_script: Array<{
    step: number;
    action: string;
    say: string;
    show: string;
    timing_seconds: number;
  }>;
  discussion_prompts: Array<{
    question: string;
    expected_responses: string[];
    follow_up: string;
  }>;
  station_cards: Array<{
    station_name: string;
    rules: string[];
    qr_code_url?: string;
    illustration?: string;
  }>;
  poster: {
    title: string;
    rules: Array<{ text: string; icon: string }>;
    footer: string;
  };
  practical_checklist: Array<{
    criterion: string;
    observable_action: string;
  }>;
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert old LearnCard[] to ContentBlock[] for backward compat */
export function migrateLearnCards(
  cards: Array<{ title: string; content: string; icon: string }>
): KeyConceptBlock[] {
  return cards.map((card, idx) => ({
    type: "key_concept" as const,
    id: `migrated-${idx}`,
    title: card.title,
    icon: card.icon,
    content: card.content,
  }));
}

/** Get blocks from a badge — prefers learning_blocks, falls back to learn_content */
export function getBlocksFromBadge(badge: {
  learning_blocks?: ContentBlock[];
  learn_content?: Array<{ title: string; content: string; icon: string }>;
}): ContentBlock[] {
  if (badge.learning_blocks && badge.learning_blocks.length > 0) {
    return badge.learning_blocks;
  }
  if (badge.learn_content && badge.learn_content.length > 0) {
    return migrateLearnCards(badge.learn_content);
  }
  return [];
}
