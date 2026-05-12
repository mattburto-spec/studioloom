import type { EllLevel, CriterionKey } from "@/lib/constants";
import type { UnitType } from "@/lib/ai/unit-types";

export interface Teacher {
  id: string;
  name: string;
  email: string;
  created_at: string;
  /** ISO timestamp. NULL = hasn't completed /teacher/welcome (migration 083). */
  onboarded_at?: string | null;
}

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  code: string;
  created_at: string;
  // Class properties (migration 033 + 055)
  framework?: string | null;
  subject?: string | null;
  grade_level?: string | null;
  is_archived?: boolean;
  academic_year?: string | null;
  instruction_language?: string | null;
  additional_languages?: string[] | null;
  // LMS integration (provider-agnostic)
  external_class_id: string | null;
  external_provider: string | null;
  last_synced_at: string | null;
}

export interface Student {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  class_id: string | null; // DEPRECATED — use class_students junction. Nullable since migration 041.
  author_teacher_id: string | null; // Teacher who owns this student record (migration 041)
  graduation_year: number | null; // Auto-calculated from year level. Stable anchor — never changes. (migration 043)
  ell_level: EllLevel;
  created_at: string;
  // LMS integration (provider-agnostic)
  external_id: string | null;
  external_provider: string | null;
  // Self-reported intake survey (migration 048)
  learning_profile: StudentLearningIntake | null;
  // Studio preferences — selected during onboarding (migration 050)
  mentor_id: "kit" | "sage" | "spark" | null;
  theme_id: "clean" | "bold" | "warm" | "dark" | null;
}

/** Self-reported intake survey data — collected once at first login.
 *  Research basis: docs/research/student-influence-factors.md
 *  6 questions covering the highest-impact measurable factors:
 *  - Languages (ELL scaffolding, peer grouping) — d=moderate
 *  - Countries (cultural framing, TCK strengths) — d=variable
 *  - Design confidence / self-efficacy — d=0.92 (highest effect size!)
 *  - Working style preference — collectivist/individualist signal (d=0.35)
 *  - Feedback preference — public/private channel (d=0.57 relationship quality)
 *  - Learning differences — optional UDL accommodation (ADHD, dyslexia, etc.)
 */
export interface StudentLearningIntake {
  // Step 1: Language background
  languages_at_home: string[];
  // Step 2: Cultural background
  countries_lived_in: string[];
  // Step 3: Design confidence (self-efficacy, d=0.92)
  design_confidence: 1 | 2 | 3 | 4 | 5;
  // Step 4: Working style preference
  working_style: "solo" | "partner" | "small_group";
  // Step 5: Feedback preference
  feedback_preference: "private" | "public";
  // Step 6: Learning differences (optional, never shared with peers)
  learning_differences: string[]; // e.g., ["adhd", "dyslexia"] — empty array if none/skipped
  // Metadata
  collected_at: string;

  // --- Dimensions v2 fields (29 Mar 2026) ---

  /** UDL-aligned accommodations — framed as barriers, not disability labels */
  accommodations?: StudentAccommodations;
  /** UDL areas where this student excels — useful for peer grouping */
  udl_strengths?: string[];
  /** UDL areas where this student needs support */
  udl_barriers?: string[];
  /** How the student prefers to receive feedback and express learning */
  communication_preferences?: CommunicationPreferences;
}

// --- Class-Student Enrollment (many-to-many, migration 041) ---

export interface ClassStudent {
  student_id: string;
  class_id: string;
  enrolled_at: string;
  unenrolled_at: string | null; // null = currently enrolled
  is_active: boolean;
  ell_level_override: EllLevel | null; // per-enrollment ELL override
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentSession {
  id: string;
  student_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Unit {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  content_data: UnitContentData;
  created_at: string;
  // Repository fields
  is_published: boolean;
  author_teacher_id: string | null;
  author_name: string | null;
  school_name: string | null;
  tags: string[];
  grade_level: string | null;
  duration_weeks: number | null;
  topic: string | null;
  global_context: string | null;
  key_concept: string | null;
  fork_count: number;
  forked_from: string | null;
  /** Unit pedagogical type — determines phases, AI persona, teaching principles. Default: "design" */
  unit_type?: UnitType;
  /** Free-text curriculum context for AI generation (e.g. "IB MYP Design Year 4", "GCSE D&T AQA") */
  curriculum_context?: string | null;
  /** ISO 639-1 language code for unit content. Default 'en'. */
  content_language?: string;
  /** Structured materials list: [{name, quantity_per_student, unit_cost, category, alternatives}] */
  materials_list?: MaterialItem[] | null;
  /** Explicit learning outcomes: [{outcome, bloom_level, measurable}] */
  learning_outcomes?: LearningOutcome[] | null;
  /** UN Sustainable Development Goals (1-17) */
  sdg_tags?: string[] | null;
  /** Subject areas this unit connects to */
  cross_curricular_links?: string[] | null;
  /** What students should know before starting this unit */
  prerequisite_knowledge?: string[] | null;
  /** Unit-level accessibility considerations */
  inclusivity_notes?: Record<string, string> | null;
}

export interface MaterialItem {
  name: string;
  quantity_per_student?: string;
  unit_cost?: string;
  category?: string;
  alternatives?: string;
}

export interface LearningOutcome {
  outcome: string;
  bloom_level?: BloomLevel;
  measurable?: boolean;
}

export interface ClassUnit {
  class_id: string;
  unit_id: string;
  is_active: boolean;
  locked_pages: string[]; // page IDs (was number[] in v1)
  // Due dates
  final_due_date: string | null;
  page_due_dates: PageDueDatesMap;
  // Per-page settings
  page_settings: PageSettingsMap;
  // Timestamps (migration 033)
  created_at?: string;
  updated_at?: string;
}

// --- Per-Page Due Dates Types ---

/** Map of page IDs to due date strings, e.g. { "A1": "2026-04-01", "B2": "2026-04-15" } */
export type PageDueDatesMap = Partial<Record<string, string>>;

// --- Per-Page Settings Types ---

export interface PageSettings {
  enabled: boolean;
  assessment_type: "formative" | "summative";
  export_pdf: boolean;
}

export type PageSettingsMap = Partial<Record<string, PageSettings>>;

export type ProgressStatus = "not_started" | "in_progress" | "complete";

export interface StudentProgress {
  id: string;
  student_id: string;
  unit_id: string;
  page_id: string;
  status: ProgressStatus;
  responses: Record<string, unknown>;
  time_spent: number;
  updated_at: string;
}

export type PlanningTaskStatus = "todo" | "in_progress" | "done";

export interface PlanningTask {
  id: string;
  student_id: string;
  unit_id: string;
  title: string;
  status: PlanningTaskStatus;
  start_date: string | null;
  target_date: string | null;
  actual_date: string | null;
  time_logged: number;
  page_id: string | null;
  sort_order: number;
  created_at: string;
}

// --- Portfolio Entry Types ---

export type PortfolioEntryType = 'entry' | 'photo' | 'link' | 'note' | 'mistake' | 'auto';

export interface PortfolioEntry {
  id: string;
  student_id: string;
  unit_id: string;
  type: PortfolioEntryType;
  content: string | null;
  media_url: string | null;
  link_url: string | null;
  link_title: string | null;
  page_id: string | null;
  section_index: number | null;
  created_at: string;
}

// --- Unit Content JSON Schema Types ---

export interface VocabTerm {
  term: string;
  definition: string;
  example?: string;
}

export interface VocabWarmup {
  terms: VocabTerm[];
  activity?: {
    type: "matching" | "fill-blank" | "drag-sort";
    items: Array<{ question: string; answer: string }>;
  };
}

export interface EllScaffolding {
  ell1?: { sentenceStarters?: string[]; hints?: string[] };
  ell2?: { sentenceStarters?: string[] };
  ell3?: { extensionPrompts?: string[] };
}

export type ResponseType = "text" | "upload" | "voice" | "link" | "multi" | "canvas" | "decision-matrix" | "pmi" | "pairwise" | "trade-off-sliders" | "toolkit-tool" | "structured-prompts" | "project-spec" | "product-brief" | "user-profile" | "success-criteria" | "choice-cards";

export interface ActivityMedia {
  type: "image" | "video";
  url: string;
  caption?: string;
}

export interface ActivityLink {
  url: string;
  label: string;
}

export type ContentStyle = "info" | "warning" | "tip" | "context" | "activity" | "speaking" | "practical" | "key-callout";

/**
 * One row in a `key-callout` block — the brand-spine magazine layout
 * shipped in src/components/lesson/KeyInformationCallout. Read-only on
 * the student side; rendered when section.contentStyle === "key-callout"
 * AND section.bullets is non-empty.
 */
export interface CalloutBullet {
  /** The term being defined, e.g. "Choice". */
  term: string;
  /** Tiny ALL-CAPS hint shown beneath the term, e.g. "autonomy". */
  hint?: string;
  /** Body paragraph. */
  body: string;
}

// --- Dimensions v2 types (Project Dimensions, 29 Mar 2026) ---

/** Bloom's taxonomy level — drives AI scaffolding depth and active/passive classification */
export type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

/** Activity time weight — replaces rigid durationMinutes as primary time signal.
 *  Phase time distributed proportionally: quick=1x, moderate=2x, extended=4x, flexible=fills remaining */
export type TimeWeight = "quick" | "moderate" | "extended" | "flexible";

/** Grouping strategy for an activity or lesson */
export type GroupingStrategy = "individual" | "pair" | "small_group" | "whole_class" | "mixed";

/** Per-activity AI behavior rules — currently hardcoded per-tool in API routes.
 *  Making this data means ANY activity can have custom AI rules. */
export interface ActivityAIRules {
  /** Thinking phase: divergent (ideation — encourage wild ideas), convergent (evaluation — encourage analysis), neutral */
  phase: "divergent" | "convergent" | "neutral";
  /** AI tone description, e.g. "warm and encouraging" or "analytical and probing" */
  tone?: string;
  /** Specific rules the AI must follow for this activity */
  rules?: string[];
  /** Words the AI must never use in responses for this activity */
  forbidden_words?: string[];
  /** Assessment framing — "learning" avoids stereotype threat (default), "diagnostic" for formal assessment */
  framing?: "learning" | "diagnostic";
}

/** Per-activity inclusivity metadata — what physical/cognitive demands does this activity make? */
export interface ActivityInclusivity {
  /** Alternative response types available if the primary one isn't accessible */
  alternative_response_types?: ResponseType[];
  requires_fine_motor?: boolean;
  requires_reading?: boolean;
  requires_writing?: boolean;
  visual_support_available?: boolean;
  audio_support_available?: boolean;
}

/** Per-lesson (page-level) inclusivity metadata — physical/sensory demands of the lesson */
export interface LessonInclusivity {
  physical_demands?: "low" | "medium" | "high";
  noise_level?: "quiet" | "moderate" | "loud";
  movement_required?: boolean;
  fine_motor_required?: boolean;
  alternative_provided?: boolean;
  sensory_warnings?: string[];
}

/** Per-activity differentiation — three levels beyond ELL scaffolding */
export interface ActivityDifferentiation {
  /** For advanced students — deeper/broader challenge */
  extension?: string;
  /** For struggling students — additional support/scaffolding */
  support?: string;
  /** For engaged students — creative/complex variant */
  challenge?: string;
}

/** Student response effort signals — computed client-side, stored for analytics */
export interface EffortSignals {
  meaningful_word_count?: number;
  reasoning_markers?: number;
  specificity_score?: number;
  revision_count?: number;
}

/** UDL-aligned student accommodations — framed as barriers, not disability labels.
 *  "Needs extra support on Language & Symbols (2.1)" not "has dyslexia" */
export interface StudentAccommodations {
  /** UDL Engagement barriers (WHY — motivation, sustaining effort, self-regulation) */
  engagement?: string[];
  /** UDL Representation barriers (WHAT — perception, language, comprehension) */
  representation?: string[];
  /** UDL Action & Expression barriers (HOW — physical action, expression, executive function) */
  action_expression?: string[];
  /** Specific needs not captured by UDL categories */
  specific_needs?: string[];
}

/** Student communication preferences */
export interface CommunicationPreferences {
  preferred_feedback?: "written" | "verbal" | "visual";
  response_preference?: "typing" | "speaking" | "drawing";
  needs_processing_time?: boolean;
}

export interface ActivitySection {
  prompt: string;
  scaffolding?: EllScaffolding;
  responseType?: ResponseType;
  exampleResponse?: string;
  portfolioCapture?: boolean;
  /** Assessment criteria this activity addresses — e.g. ["A","B"] or ["AO1","AO3"]. Framework-agnostic. */
  criterionTags?: string[];
  /** Estimated duration in minutes — optional soft suggestion. Use timeWeight as primary signal. */
  durationMinutes?: number;
  /** Stable activity ID from v4 timeline — used for response keys that survive rebalancing. */
  activityId?: string;
  media?: ActivityMedia;
  links?: ActivityLink[];
  /** Visual style for content-only blocks (no responseType). */
  contentStyle?: ContentStyle;
  /** For toolkit-tool responseType: which tool to render (e.g., "scamper", "decision-matrix"). */
  toolId?: string;
  /** For toolkit-tool responseType: pre-filled challenge/topic (optional). */
  toolChallenge?: string;
  /** For structured-prompts responseType (AG.1): the array of prompts students respond to. Authored at unit-creation time; immutable from student side. See src/lib/structured-prompts/types.ts. */
  prompts?: import("@/lib/structured-prompts/types").StructuredPromptsConfig;
  /** For structured-prompts responseType: require a photo before submit. Default false. */
  requirePhoto?: boolean;
  /** For structured-prompts responseType (AG.2.4): when true, after a successful save, fire-and-forget append a Kanban backlog card from the "next" prompt's response. Default false. Set to true on the Process Journal palette block. */
  autoCreateKanbanCardOnSave?: boolean;

  // --- Dimensions v2 fields (29 Mar 2026) ---

  /** Bloom's taxonomy level — drives AI scaffolding depth and active/passive classification */
  bloom_level?: BloomLevel;
  /** Time weight — primary time signal. Phase budget distributed proportionally by weight. */
  timeWeight?: TimeWeight;
  /** Who does this activity — individual, pair, small group, or whole class */
  grouping?: GroupingStrategy;
  /** Per-activity AI behavior rules — phase, tone, custom rules, forbidden words */
  ai_rules?: ActivityAIRules;
  /** UDL checkpoint IDs this activity addresses — e.g. ["5.1", "8.2", "2.1"]. Auto-tagged by AI. */
  udl_checkpoints?: string[];
  /** Inclusivity metadata — physical/cognitive demands and alternatives */
  inclusivity?: ActivityInclusivity;
  /** Observable behaviors the teacher watches for — e.g. "Student sketches at least 3 options" */
  success_look_fors?: string[];
  /** Three-level differentiation beyond ELL scaffolding */
  differentiation?: ActivityDifferentiation;
  /** Searchable tags for activity block library — e.g. "interview", "research", "hands-on" */
  tags?: string[];
  /** Dimensions2: ID of the Activity Block this was generated from (if any). Enables efficacy tracking. */
  source_block_id?: string;
  /** Workshop phase this activity belongs to. Defaults to "workTime" when missing (legacy). */
  phase?: "opening" | "miniLesson" | "workTime" | "debrief";

  // ── Lever 1 v2 slot fields (sub-phase 1B added the SQL columns + JSONB shape) ──

  /** v2 slot — one-sentence orient (≤200 chars). Renders as muted lead paragraph. NULL during transition window; renderer (ComposedPrompt) falls back to `prompt` when all three slot fields are null. */
  framing?: string;
  /** v2 slot — imperative body (≤800 chars soft cap). Renders as regular body. */
  task?: string;
  /** v2 slot — what students produce/record/submit (≤200 chars). Renders with 🎯 prefix + bold weight. */
  success_signal?: string;

  // ── LIS.C — Stepper layout opt-in for structured-prompts ──

  /** When set to "stepper", structured-prompts render via the LIS MultiQuestionResponse component (one question at a time, criterion-coloured). Default undefined → existing all-at-once StructuredPromptsResponse. */
  promptsLayout?: "stepper";

  // ── Key-callout block (LIS.A, 10 May 2026) ──

  /** For contentStyle === "key-callout": rows in the magazine-layout callout. When set, ActivityCard renders KeyInformationCallout instead of the default ComposedPrompt body. */
  bullets?: CalloutBullet[];
  /** For contentStyle === "key-callout": title rendered above the bullets. Array → one word per line for visual rhythm; string → single line. Falls back to `prompt` when omitted. */
  bulletsTitle?: string | string[];
  /** For contentStyle === "key-callout": short intro paragraph beneath the title. Optional. */
  bulletsIntro?: string;
  /** For contentStyle === "key-callout": override the default "Worth remembering" eyebrow chip. */
  bulletsEyebrow?: string;

  // ── Choice Cards block (12 May 2026) ──

  /** For responseType === "choice-cards": deck composition + behaviour. See ChoiceCardsBlockConfig. */
  choiceCardsConfig?: import("@/components/teacher/lesson-editor/BlockPalette.types").ChoiceCardsBlockConfig;

  // ── Archetype-aware blocks (12 May 2026 — A12 in design-guidelines.md) ──

  /**
   * Per-archetype overrides for framing/task/success_signal/examples/prompts
   * (plus block-specific passthrough fields). When set, the renderer reads
   * via `getArchetypeAwareContent(block, studentArchetype)` and uses the
   * archetype-specific entry when a student's resolved archetype matches a
   * key, falling back to the base block fields otherwise. Keys are stable
   * archetype IDs (e.g. "toy-design", "architecture-interior",
   * "app-digital-tool") matching PRODUCT_BRIEF_ARCHETYPES, plus optional
   * card-slug keys (e.g. "g8-brief-designer-mentor") for brief-specific
   * variants.
   *
   * Universal in shape, project-aware in voice. Never used for core
   * structure — only voice + examples + framing.
   */
  archetype_overrides?: {
    [archetypeId: string]: {
      framing?: string;
      task?: string;
      success_signal?: string;
      examples?: string[];
      prompts?: string[];
      // Block-specific overrides allowed via passthrough:
      [key: string]: unknown;
    };
  };
}

export interface Reflection {
  type: "confidence-slider" | "checklist" | "short-response";
  items: string[];
}

/**
 * Lesson phase timing — 4 role-based slots that map to any lesson structure.
 *
 * The 4 keys are ROLE SLOTS, not literal Workshop Model phases:
 * - opening   → setup/opening role (hook, safety check, stimulus, review)
 * - miniLesson → instruction/guided role (demo, mini-lesson, guided investigation). Set durationMinutes=0 for structures without instruction.
 * - workTime  → main block role (the sustained student work phase)
 * - debrief   → closing role (debrief, reflection, share findings, clean-up + reflect)
 *
 * Each slot carries a `phaseName` field with the structure-specific label
 * (e.g., "Extended Making" instead of "Work Time" for a making lesson).
 *
 * Legacy code that accesses `.opening.durationMinutes` etc. still works unchanged.
 */
export interface WorkshopPhases {
  opening: { durationMinutes: number; hook?: string; phaseName?: string };
  miniLesson: { durationMinutes: number; focus?: string; phaseName?: string };
  workTime: { durationMinutes: number; focus?: string; checkpoints?: string[]; phaseName?: string };
  debrief: { durationMinutes: number; protocol?: string; prompt?: string; phaseName?: string };
}

/** The 4 structural roles in any lesson — maps to workshopPhases keys */
export type LessonPhaseRole = "opening" | "miniLesson" | "workTime" | "debrief";

/** Extension activity for early finishers */
export interface LessonExtension {
  title: string;
  description: string;
  durationMinutes: number;
  designPhase?: "investigation" | "ideation" | "prototyping" | "evaluation";
}

export interface PageContent {
  title: string;
  learningGoal: string;
  vocabWarmup?: VocabWarmup;
  introduction?: {
    text: string;
    media?: { type: "image" | "video"; url: string };
    links?: ActivityLink[];
  };
  sections: ActivitySection[];
  reflection?: Reflection;
  /** Lesson phase timing — 4 role-based slots. phaseName on each slot gives the structure-specific label. */
  workshopPhases?: WorkshopPhases;
  /** Early finisher extensions, indexed by design phase */
  extensions?: LessonExtension[];

  // --- Dimensions v2 fields (29 Mar 2026) ---

  /** Per-lesson inclusivity metadata — physical/sensory demands */
  inclusivity?: LessonInclusivity;
  /** Private teacher notes — teaching tips, common misconceptions, timing adjustments */
  teacher_notes?: string;
  /** What "good" looks like — student-facing success criteria */
  success_criteria?: string[];
  /** Default grouping strategy for this lesson */
  grouping_strategy?: GroupingStrategy;
  /** UDL coverage summary — computed client-side from activities' udl_checkpoints */
  udl_coverage?: {
    engagement: boolean;
    representation: boolean;
    action_expression: boolean;
  };
}

// --- Flexible Page Types (v2) ---

export type PageType = "strand" | "context" | "skill" | "reflection" | "custom" | "lesson";

export interface UnitPage {
  id: string;                // nanoid(8) for new pages; "A1"/"B3" for migrated v1
  type: PageType;
  criterion?: CriterionKey;  // only for "strand" type
  strandIndex?: number;      // e.g. 1-4 within criterion
  phaseLabel?: string;       // v4 timeline phase grouping ("Research", "Ideation", etc.)
  title: string;
  content: PageContent;
}

export interface UnitContentDataV2 {
  version: 2;
  pages: UnitPage[];
}

/** v3: journey-based — lessons as sequential blocks, criteria as section-level tags. */
export interface UnitContentDataV3 {
  version: 3;
  generationModel: "journey";
  pages: UnitPage[];
  lessonLengthMinutes?: number;
  assessmentCriteria?: string[];
}

// --- Timeline Types (v4) ---

export type DesignLessonType = "research" | "ideation" | "skills-demo" | "making" | "testing" | "critique";

export type TimelineActivityRole = "warmup" | "intro" | "core" | "reflection" | "content";

/** A single activity in the unit timeline. Activities belong to the unit, not to lessons. */
export interface TimelineActivity {
  id: string;                    // nanoid(8) — stable across lesson rebalancing
  role: TimelineActivityRole;
  title: string;
  /**
   * Composed legacy prompt. Lever 1 v2: kept as the back-compat read
   * path for non-migrated consumers (output-adapter composes it from
   * the three slots at validation/persist time). New code should read
   * via `composedPromptText(activity)` so the slot fields take
   * precedence when populated.
   */
  prompt: string;
  // ── Lever 1 v2 slot fields (1G AI now produces these in the timeline schema) ──
  /** v2 slot — one-sentence orient (≤200 chars). Populated by AI; survives wizard reduce. */
  framing?: string;
  /** v2 slot — imperative body (≤800 chars soft cap). */
  task?: string;
  /** v2 slot — what students produce/record/submit (≤200 chars). */
  success_signal?: string;
  durationMinutes: number;       // Resolved at runtime from timeWeight if not set by AI
  timeWeight?: TimeWeight;       // Primary signal: quick | moderate | extended | flexible
  responseType?: ResponseType;   // optional — content-role activities have no response
  scaffolding?: EllScaffolding;
  exampleResponse?: string;
  portfolioCapture?: boolean;
  criterionTags?: string[];
  phaseLabel?: string;           // "Research", "Prototyping" — grouping hint from AI
  media?: ActivityMedia;
  links?: ActivityLink[];
  contentStyle?: ContentStyle;   // visual style for content-role blocks
  // Role-specific fields
  vocabTerms?: VocabTerm[];      // for warmup role
  reflectionType?: "confidence-slider" | "checklist" | "short-response";
  reflectionItems?: string[];    // for reflection role
  teacherNotes?: string;         // questioning prompts, safety reminders, differentiation tips
}

/** Computed lesson boundary — derived at runtime from timeline + lessonLength. Not manually set. */
export interface ComputedLesson {
  lessonNumber: number;
  lessonId: string;              // "L01", "L02"
  activityIds: string[];         // which activities fall in this lesson
  totalMinutes: number;          // sum of activity durations in this lesson
  slackMinutes: number;          // lessonLength - totalMinutes
}

/** v4: timeline-based — activities as a flat sequence, lessons computed from duration. */
export interface UnitContentDataV4 {
  version: 4;
  generationModel: "timeline";
  timeline: TimelineActivity[];
  lessonLengthMinutes: number;
  assessmentCriteria?: string[];
}

// --- Timeline Outline Types ---

export interface TimelinePhase {
  phaseId: string;
  title: string;                 // "Research & Discovery"
  summary: string;
  estimatedLessons: number;      // approximate count
  primaryFocus: string;
  criterionTags: string[];
}

export interface TimelineOutlineOption {
  approach: string;
  description: string;
  strengths: string[];
  phases: TimelinePhase[];
  estimatedActivityCount: number;
}

/** Lightweight lesson skeleton — generated fast (~10-15s) before full activity generation */
export interface TimelineLessonSkeleton {
  lessonNumber: number;
  lessonId: string;              // "L01", "L02"
  title: string;
  keyQuestion: string;
  estimatedMinutes: number;
  phaseLabel: string;
  criterionTags: string[];
  activityHints: string[];       // ["Warmup: vocab review", "Core: product teardown", "Reflection: surprises"]
  lessonType?: DesignLessonType; // AI-classified lesson structure type
  learningIntention?: string;    // "Students will be able to..."
  successCriteria?: string[];    // 2-3 observable criteria
  cumulativeVocab?: string[];    // Key vocab introduced up to and including this lesson
  cumulativeSkills?: string[];   // Key skills/techniques introduced up to and including this lesson
}

/** Full skeleton for a unit — provides context for per-lesson parallel generation */
export interface TimelineSkeleton {
  lessons: TimelineLessonSkeleton[];
  narrativeArc: string;          // 2-3 sentence unit flow summary
}

/** v1: keyed by PageId ("A1"-"D4"). v2: ordered array. v3: journey. v4: timeline. */
export type UnitContentData =
  | { pages?: Partial<Record<string, PageContent>> }
  | UnitContentDataV2
  | UnitContentDataV3
  | UnitContentDataV4;

// --- LMS Integration Types ---

export type LMSProviderType = "managebac" | "toddle" | "canvas" | "schoology";

export interface TeacherIntegration {
  id: string;
  teacher_id: string;
  provider: LMSProviderType;
  subdomain: string | null;
  encrypted_api_token: string | null;
  lti_consumer_key: string | null;
  lti_consumer_secret: string | null;
  created_at: string;
  updated_at: string;
}

// --- AI Unit Creator Types ---

export interface AISettings {
  teacher_id: string;
  provider: string;
  api_endpoint: string;
  model_name: string;
  // encrypted_api_key is never sent to client
}

export type CriteriaFocusLevel = "standard" | "emphasis" | "light";

export interface UnitWizardInput {
  title: string;
  gradeLevel: string;
  durationWeeks: number;
  topic: string;
  globalContext: string;
  keyConcept: string;
  relatedConcepts: string[];
  statementOfInquiry: string;
  selectedCriteria: CriterionKey[];
  criteriaFocus: Partial<Record<CriterionKey, CriteriaFocusLevel>>;
  atlSkills: string[];
  specificSkills: string[];
  resourceUrls: string[];
  specialRequirements: string;
  /** Unit pedagogical type — determines phases, AI persona, teaching principles. Default: "design" */
  unitType?: UnitType;
  /** Structured framework ID from CURRICULUM_FRAMEWORKS registry (e.g. "IB_MYP", "GCSE_DT", "ACARA_DT"). Determines criteria, vocabulary, grading scale. */
  framework?: string;
  /** Free-text curriculum context for AI generation (e.g. "IB MYP Design Year 4", "PYP Exhibition") */
  curriculumContext?: string;
  // Service-specific
  communityContext?: string;
  sdgConnection?: string;
  serviceOutcomes?: string[];
  partnerType?: string;
  // Personal Project-specific
  personalInterest?: string;
  goalType?: string;
  presentationFormat?: string;
  // Inquiry-specific
  centralIdea?: string;
  transdisciplinaryTheme?: string;
  linesOfInquiry?: string[];
  // Context Injection fields — ground generation in classroom reality
  /** Real-world connection or driving scenario (e.g. "We're redesigning the school cafeteria queue system") */
  realWorldContext?: string;
  /** What students just finished or relevant class background (e.g. "Just completed a sustainability unit, burned out on research") */
  studentContext?: string;
  /** Room/equipment/time constraints (e.g. "No access to workshop until Week 3, 28 students, half never used Arduino") */
  classroomConstraints?: string;
}

// --- Journey-Based Unit Generation Types (v3) ---

/** Input for journey-mode unit generation — end goal + weeks, criteria as tags not structure. */
export interface LessonJourneyInput {
  title: string;
  gradeLevel: string;
  endGoal: string;
  durationWeeks: number;
  lessonsPerWeek: number;
  lessonLengthMinutes: number;
  topic: string;
  globalContext: string;
  keyConcept: string;
  relatedConcepts: string[];
  statementOfInquiry: string;
  atlSkills: string[];
  specificSkills: string[];
  resourceUrls: string[];
  specialRequirements: string;
  /** Which assessment criteria exist for tagging (e.g. ["A","B","C","D"] for MYP). Not structural. */
  assessmentCriteria: string[];
  curriculumFramework?: string;
  /** Unit pedagogical type — determines phases, AI persona, teaching principles. Default: "design" */
  unitType?: UnitType;
  /** Free-text curriculum context for AI generation (e.g. "IB MYP Design Year 4", "PYP Exhibition") */
  curriculumContext?: string;
  // Service-specific
  communityContext?: string;
  sdgConnection?: string;
  serviceOutcomes?: string[];
  partnerType?: string;
  // Personal Project-specific
  personalInterest?: string;
  goalType?: string;
  presentationFormat?: string;
  // Inquiry-specific
  centralIdea?: string;
  transdisciplinaryTheme?: string;
  linesOfInquiry?: string[];
  // Context Injection fields — ground generation in classroom reality
  /** Real-world connection or driving scenario */
  realWorldContext?: string;
  /** What students just finished or relevant class background */
  studentContext?: string;
  /** Room/equipment/time constraints */
  classroomConstraints?: string;
}

/** A single lesson in a journey outline. */
export interface JourneyOutlineLesson {
  lessonId: string;
  title: string;
  summary: string;
  primaryFocus: string;
  criterionTags: string[];
}

/** One of 3 journey outline approaches the teacher can pick. */
export interface JourneyOutlineOption {
  approach: string;
  description: string;
  strengths: string[];
  lessonPlan: JourneyOutlineLesson[];
}

// --- Auth context types ---

export interface StudentAuthContext {
  student: Student;
  classInfo: Class;
}

export interface TeacherAuthContext {
  teacher: Teacher;
}

// --- Student Design Assistant types ---

export interface DesignConversation {
  id: string;
  studentId: string;
  unitId: string;
  pageId?: string;
  startedAt: string;
  endedAt?: string;
  turnCount: number;
  bloomLevel: number;      // 1-6 (Bloom's taxonomy)
  effortScore: number;     // 3-strike effort gating
  summary?: string;
}

export interface ConversationTurn {
  id: string;
  conversationId: string;
  turnNumber: number;
  role: "student" | "assistant";
  content: string;
  questionType?: string;   // Richard Paul's 6 question types
  bloomLevel?: number;
  createdAt: string;
}

// --- Open Studio Types ---

export type OpenStudioStatusValue = "locked" | "unlocked" | "revoked";
export type OpenStudioUnlockedBy = "teacher" | "auto" | "criteria";
export type OpenStudioRevokedReason = "teacher_manual" | "drift_detected" | "recalibrate";
export type OpenStudioProductivityScore = "low" | "medium" | "high";
export type OpenStudioDriftLevel = "gentle" | "direct" | "silent";

export interface OpenStudioStatus {
  id: string;
  student_id: string;
  unit_id: string;
  class_id: string;
  status: OpenStudioStatusValue;
  unlocked_by: OpenStudioUnlockedBy;
  teacher_note: string | null;
  check_in_interval_min: number;
  carry_forward: boolean;
  unlocked_at: string | null;
  revoked_at: string | null;
  revoked_reason: OpenStudioRevokedReason | null;
  created_at: string;
  updated_at: string;
}

export interface OpenStudioDriftFlag {
  level: OpenStudioDriftLevel;
  message: string;
  timestamp: string;
}

export interface OpenStudioActivityEntry {
  type: "save" | "tool_use" | "response" | "reflection" | "ai_chat";
  description: string;
  timestamp: string;
}

export interface OpenStudioSession {
  id: string;
  student_id: string;
  unit_id: string;
  status_id: string;
  session_number: number;
  focus_area: string | null;
  started_at: string;
  ended_at: string | null;
  activity_log: OpenStudioActivityEntry[];
  ai_interactions: number;
  check_in_count: number;
  drift_flags: OpenStudioDriftFlag[];
  productivity_score: OpenStudioProductivityScore | null;
  ai_summary: string | null;
  reflection: string | null;
}

// --- Open Studio Profile — Discovery output
export type OpenStudioArchetype = 'make' | 'research' | 'lead' | 'serve' | 'create' | 'solve' | 'entrepreneurship';
export type OpenStudioDiscoveryStep = 'strengths' | 'interests' | 'needs' | 'narrowing' | 'commitment' | 'complete';

export interface OpenStudioStrength {
  area: string;
  description: string;
}

export interface OpenStudioInterest {
  topic: string;
  category: string;
}

export interface OpenStudioNeed {
  need: string;
  context: string;
}

export interface OpenStudioConversationMessage {
  role: 'ai' | 'student';
  content: string;
  step: OpenStudioDiscoveryStep;
  timestamp: string;
}

export interface OpenStudioProfile {
  id: string;
  student_id: string;
  unit_id: string;
  strengths: OpenStudioStrength[];
  interests: OpenStudioInterest[];
  needs_identified: OpenStudioNeed[];
  project_statement: string | null;
  archetype: OpenStudioArchetype | null;
  discovery_conversation: OpenStudioConversationMessage[];
  discovery_step: OpenStudioDiscoveryStep;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Open Studio Journey Phase (client-side state)
export type OpenStudioJourneyPhase = 'discovery' | 'planning' | 'working' | 'sharing';

// --- Student Toolkit Tool Sessions ---

export interface StudentToolSession {
  id: string;
  student_id: string;
  tool_id: string;
  challenge: string;
  mode: "embedded" | "standalone";
  unit_id: string | null;
  page_id: string | null;
  section_index: number | null;
  state: Record<string, unknown>;
  summary: Record<string, unknown> | null;
  version: number;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  portfolio_entry_id: string | null;
}

// --- Safety Badges System ---

export type BadgeCategory = "safety" | "skill" | "software";
export type BadgeTier = 1 | 2 | 3 | 4;
export type BadgeStatus = "active" | "expired" | "revoked";

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: BadgeCategory;
  tier: BadgeTier;
  icon_name: string;
  color: string;
  is_built_in: boolean;
  created_by_teacher_id: string | null;
  pass_threshold: number;
  expiry_months: number | null;
  retake_cooldown_minutes: number;
  question_count: number;
  question_pool: QuestionPoolItem[];
  learn_content: LearningCard[];
  topics: string[];
  created_at: string;
  updated_at: string;
}

export interface QuestionPoolItem {
  id: string;
  text: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correct_answer: string | number;
}

export interface LearningCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  tips: string[];
  examples: string[];
}

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  score: number | null;
  attempt_number: number;
  granted_by: string;
  teacher_note: string | null;
  status: BadgeStatus;
  answers: Record<string, unknown>[];
  time_taken_seconds: number | null;
  awarded_at: string;
  expires_at: string | null;
  created_at: string;
}

// --- Class Gallery & Peer Review System ---

export type GalleryStatus = "open" | "closed";
export type ReviewFormat = "comment" | "pmi" | "two-stars-wish" | string; // string for tool_id

export type GalleryDisplayMode = "grid" | "canvas";

export interface GalleryRound {
  id: string;
  unit_id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string;
  page_ids: string[];
  review_format: ReviewFormat;
  min_reviews: number;
  anonymous: boolean;
  status: GalleryStatus;
  display_mode: GalleryDisplayMode;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface GallerySubmission {
  id: string;
  round_id: string;
  student_id: string;
  context_note: string;
  content: Record<string, unknown>;
  canvas_x: number | null;
  canvas_y: number | null;
  created_at: string;
}

export interface GalleryReview {
  id: string;
  submission_id: string;
  round_id: string;
  reviewer_id: string;
  review_data: Record<string, unknown>;
  created_at: string;
}

// Teacher monitoring view: gallery round with stats
export interface GalleryRoundWithStats extends GalleryRound {
  submission_count: number;
  submissions: Array<{
    id: string;
    student_id: string;
    student_name: string;
    context_note: string;
    created_at: string;
    review_count: number;
    is_complete: boolean;
  }>;
}

// --- Dimensions2: Activity Block Library (2 Apr 2026) ---

/** Source type for an Activity Block — where it came from */
export type ActivityBlockSource = "extracted" | "generated" | "manual" | "community";

/** Design thinking phase for categorization */
export type DesignPhase = "discover" | "define" | "ideate" | "prototype" | "test";

/** Role of a block within a lesson structure */
export type LessonStructureRole = "opening" | "instruction" | "core" | "reflection";

/** A reusable activity block — first-class entity in the Activity Block Library.
 *  Extracted from uploads (Pass 2 lesson_flow), generated units, or manually created.
 *  Carries Dimensions v1 metadata + efficacy scoring from System 4 feedback loop. */
export interface ActivityBlock {
  id: string;
  teacher_id: string;

  // Identity
  title: string;
  description: string | null;
  prompt: string;
  // Lever 1 v2 slot fields (sub-phase 1B). Nullable for legacy rows.
  framing: string | null;
  task: string | null;
  success_signal: string | null;

  // Source tracking
  source_type: ActivityBlockSource;
  source_upload_id: string | null;
  source_unit_id: string | null;
  source_page_id: string | null;
  source_activity_index: number | null;

  // Dimensions metadata (mirrors ActivitySection)
  bloom_level: BloomLevel | null;
  time_weight: TimeWeight | null;
  grouping: GroupingStrategy | null;
  ai_rules: ActivityAIRules | null;
  udl_checkpoints: string[] | null;
  success_look_fors: string[] | null;

  // Pedagogical metadata
  design_phase: DesignPhase | null;
  lesson_structure_role: LessonStructureRole | null;
  response_type: ResponseType | null;
  toolkit_tool_id: string | null;
  criterion_tags: string[] | null;

  // Resources
  materials_needed: string[] | null;
  scaffolding: EllScaffolding | null;
  example_response: string | null;

  // Quality signals (System 4)
  efficacy_score: number;
  times_used: number;
  times_skipped: number;
  times_edited: number;
  avg_time_spent: number | null;
  avg_completion_rate: number | null;

  // Search
  tags: string[] | null;

  // Lifecycle
  is_public: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Params for creating a new Activity Block */
export interface CreateActivityBlockParams {
  title: string;
  description?: string;
  prompt: string;
  /** Lever 1 v2 slot — one-sentence orient (≤200 chars). Renderer composes this with task + success_signal. NULL during transition window; renderer falls back to `prompt` when all three are null. */
  framing?: string;
  /** Lever 1 v2 slot — imperative body (≤800 chars soft cap). */
  task?: string;
  /** Lever 1 v2 slot — what students produce/record/submit (≤200 chars). */
  success_signal?: string;
  source_type: ActivityBlockSource;
  source_upload_id?: string;
  source_unit_id?: string;
  source_page_id?: string;
  source_activity_index?: number;
  bloom_level?: BloomLevel;
  time_weight?: TimeWeight;
  grouping?: GroupingStrategy;
  ai_rules?: ActivityAIRules;
  udl_checkpoints?: string[];
  success_look_fors?: string[];
  design_phase?: DesignPhase;
  lesson_structure_role?: LessonStructureRole;
  response_type?: ResponseType;
  toolkit_tool_id?: string;
  criterion_tags?: string[];
  materials_needed?: string[];
  scaffolding?: EllScaffolding;
  example_response?: string;
  tags?: string[];
  is_public?: boolean;
}

/** Teacher edit tracking — what changed after AI generation */
export type GenerationFeedbackType = "kept" | "deleted" | "rewritten" | "reordered" | "scaffolding_changed" | "time_changed";

export interface GenerationFeedback {
  id: string;
  teacher_id: string;
  unit_id: string;
  class_id: string | null;
  page_id: string;
  activity_index: number | null;
  source_block_id: string | null;
  feedback_type: GenerationFeedbackType;
  original_content: Record<string, unknown> | null;
  modified_content: Record<string, unknown> | null;
  created_at: string;
}

// --- Dimensions v2: Activity Response Tracking (29 Mar 2026) ---

/** Per-activity response metadata — stored alongside content in student_progress.responses JSONB.
 *  These fields are added to the response object for each activity_<activityId> key. */
export interface ActivityResponseMeta {
  /** Seconds spent on this specific activity (IntersectionObserver-based) */
  time_spent_seconds?: number;
  /** Which attempt this is (1 = first try, 2+ = revision) */
  attempt_number?: number;
  /** Client-computed effort signals for analytics */
  effort_signals?: EffortSignals;
}
