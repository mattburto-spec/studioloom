/**
 * Skills Library types — S2A authoring + student viewer.
 *
 * Block is a discriminated union of the six body-block kinds supported in
 * the v1 editor. All blocks round-trip through `skill_cards.body` as JSONB,
 * preserving type tags. External media blocks (image/video) accept a URL in
 * S2A; S2B adds an optional uploadPath field for Supabase Storage assets.
 *
 * Keep this file dependency-free — it's imported by both server routes and
 * client components.
 */

// ============================================================================
// Block body — discriminated union
//
// The deprecated legacy block types (ProseBlock, CalloutBlock, etc.) are
// defined further down in this file as ProseBlock_Deprecated etc. Type
// aliases preserve the old names so any existing code referring to
// `ProseBlock` keeps compiling. Do not re-add the old definitions here.
// ============================================================================

// ============================================================================
// Rich blocks — the "world-class" block types ported from the safety system
// (src/lib/safety/content-blocks.ts). These are pedagogically purpose-built
// and replace the earlier generic blocks as the primary authoring vocabulary.
//
// Design principles (from docs/projects/skills-library-research-brief.md):
//   - One card = one competency; blocks are the internal structure.
//   - Every block has explicit teaching intent (a key_lesson, a related_rule,
//     a correct/wrong feedback pair). No "just some text in a box."
//   - Blocks are composable — a card can mix a micro_story, a key_concept,
//     a step_by_step, and a comprehension_check.
// ============================================================================

/**
 * Core teaching block. Rich content — markdown + icon + tips + examples +
 * optional warning + optional image. Replaces the earlier generic `prose`
 * and `callout` blocks; use this whenever you want "here's a concept."
 */
export type KeyConceptBlock = {
  type: "key_concept";
  title: string;
  icon?: string;            // emoji or single char; renders at top-left
  content: string;          // markdown-lite (paragraphs + **bold** + *italic*)
  tips?: string[];
  examples?: string[];
  warning?: string;         // highlighted callout inside the block
  image?: string;           // URL; optional inline image
};

/**
 * A real (or realistic) incident narrative with analysis reveals. Powerful
 * for safety, resilience, ethics cards. Each analysis prompt shows a
 * question first; student clicks to reveal the answer. Ends with the
 * explicit key_lesson and (optionally) a rule reference.
 */
export type MicroStoryBlock = {
  type: "micro_story";
  title: string;
  narrative: string;                 // the story itself (paragraphs)
  is_real_incident: boolean;         // labeled "Real incident" if true
  analysis_prompts: Array<{ question: string; reveal_answer: string }>;
  key_lesson: string;                // headline takeaway
  related_rule?: string;             // e.g. "Workshop rule #3"
};

/**
 * Branching decision scenario. Student picks a choice; each branch has
 * correct/incorrect + specific feedback + optional consequence. Supports
 * chaining via next_branch_id so you can build multi-step decision trees.
 */
export type ScenarioBlock = {
  type: "scenario";
  title: string;
  setup: string;                     // situation description
  illustration?: string;             // optional URL
  branches: Array<{
    id: string;
    choice_text: string;
    is_correct: boolean;
    feedback: string;
    consequence?: string;
    next_branch_id?: string;         // for multi-step chains
  }>;
};

/**
 * Structured before/after comparison. Unlike CompareImagesBlock, this
 * carries explicit teaching payload: what hazards are in "before", what
 * principles fix them in "after", and the headline key_difference.
 */
export type BeforeAfterBlock = {
  type: "before_after";
  title: string;
  before: { image?: string; caption: string; hazards: string[] };
  after:  { image?: string; caption: string; principles: string[] };
  key_difference: string;
};

/**
 * Numbered step sequence with per-step image + warning + optional
 * checkpoint. Replaces both `worked_example` and `checklist`.
 */
export type StepByStepBlock = {
  type: "step_by_step";
  title: string;
  steps: Array<{
    number: number;
    instruction: string;
    image?: string;
    warning?: string;
    checkpoint?: string;             // "check before continuing"
  }>;
};

/**
 * Single-question multiple-choice check — preview of the S3 quiz engine.
 * Correct + wrong feedback authored per-question; optional hint.
 */
export type ComprehensionCheckBlock = {
  type: "comprehension_check";
  question: string;
  options: string[];
  correct_index: number;             // 0-based index into options[]
  feedback_correct: string;
  feedback_wrong: string;
  hint?: string;                     // shown on first wrong attempt
};

/**
 * YouTube / Vimeo embed with start/end trim. Replaces the earlier generic
 * `video` block. URL parsing identifies provider at render time.
 */
export type VideoEmbedBlock = {
  type: "video_embed";
  title?: string;
  url: string;
  start_time?: number;               // seconds; optional trim start
  end_time?: number;                 // seconds; optional trim end
  caption?: string;
};

// ============================================================================
// Generic blocks that safety doesn't have — keep because they fill real gaps
// ============================================================================

/**
 * Generic iframe embed. Domain-safelisted at render time (Sketchfab, Figma,
 * Codepen, Miro, Desmos, Observable, GeoGebra). Video goes in VideoEmbedBlock.
 */
export type EmbedBlock = {
  type: "embed";
  url: string;
  title?: string;
  aspectRatio?: "16:9" | "4:3" | "1:1";
  caption?: string;
};

/** Click-to-reveal collapsible. Body is markdown-lite like prose. */
export type AccordionBlock = {
  type: "accordion";
  title: string;
  body: string;
};

/** Paginated image gallery (one-at-a-time with prev/next + dots). */
export type GalleryBlock = {
  type: "gallery";
  images: Array<{ url: string; caption?: string; alt?: string }>;
};

// ============================================================================
// Deprecated blocks — legacy shape from the earlier S2A.5 batch. Not shown
// in the "Add block" menu any more, but renderers keep them working so old
// bodies don't go dark. When Matt replaces the 3 seed cards these go away
// from the DB naturally.
// ============================================================================

/** @deprecated — use KeyConceptBlock instead. */
export type ProseBlock_Deprecated = {
  type: "prose";
  text: string;
};

/** @deprecated — use KeyConceptBlock with `warning` field. */
export type CalloutBlock_Deprecated = {
  type: "callout";
  tone: "tip" | "warning" | "note";
  text: string;
};

/** @deprecated — use StepByStepBlock. */
export type ChecklistBlock_Deprecated = {
  type: "checklist";
  items: string[];
};

/** @deprecated — use KeyConceptBlock.image or GalleryBlock. */
export type ImageBlock_Deprecated = {
  type: "image";
  url: string;
  caption?: string;
  alt?: string;
  uploadPath?: string;
};

/** @deprecated — use VideoEmbedBlock. */
export type VideoBlock_Deprecated = {
  type: "video";
  url: string;
  caption?: string;
  uploadPath?: string;
};

/** @deprecated — use StepByStepBlock. */
export type WorkedExampleBlock_Deprecated = {
  type: "worked_example";
  title: string;
  steps: string[];
};

/** @deprecated — use MicroStoryBlock. */
export type ThinkAloudBlock_Deprecated = {
  type: "think_aloud";
  prompt: string;
  answer: string;
};

/** @deprecated — use BeforeAfterBlock. */
export type CompareImagesBlock_Deprecated = {
  type: "compare_images";
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  caption?: string;
};

/** @deprecated — niche; removed from authoring menu. */
export type CodeBlock_Deprecated = {
  type: "code";
  code: string;
  language?: string;
  filename?: string;
};

/** @deprecated — use BeforeAfterBlock or two adjacent KeyConceptBlocks. */
export type SideBySideBlock_Deprecated = {
  type: "side_by_side";
  leftTitle?: string;
  leftText: string;
  rightTitle?: string;
  rightText: string;
};

// ============================================================================
// Block union + registries
// ============================================================================

// Legacy type aliases for any external code still referencing the old names.
// Point to the deprecated shapes so DB bodies round-trip through the union.
export type ProseBlock           = ProseBlock_Deprecated;
export type CalloutBlock         = CalloutBlock_Deprecated;
export type ChecklistBlock       = ChecklistBlock_Deprecated;
export type ImageBlock           = ImageBlock_Deprecated;
export type VideoBlock           = VideoBlock_Deprecated;
export type WorkedExampleBlock   = WorkedExampleBlock_Deprecated;
export type ThinkAloudBlock      = ThinkAloudBlock_Deprecated;
export type CompareImagesBlock   = CompareImagesBlock_Deprecated;
export type CodeBlockBlock       = CodeBlock_Deprecated;
export type SideBySideBlock      = SideBySideBlock_Deprecated;

export type Block =
  // Rich pedagogical blocks (primary authoring vocabulary)
  | KeyConceptBlock
  | MicroStoryBlock
  | ScenarioBlock
  | BeforeAfterBlock
  | StepByStepBlock
  | ComprehensionCheckBlock
  | VideoEmbedBlock
  // Generic blocks that fill real gaps
  | EmbedBlock
  | AccordionBlock
  | GalleryBlock
  // Deprecated — kept for legacy body compatibility, not shown in the editor
  | ProseBlock_Deprecated
  | CalloutBlock_Deprecated
  | ChecklistBlock_Deprecated
  | ImageBlock_Deprecated
  | VideoBlock_Deprecated
  | WorkedExampleBlock_Deprecated
  | ThinkAloudBlock_Deprecated
  | CompareImagesBlock_Deprecated
  | CodeBlock_Deprecated
  | SideBySideBlock_Deprecated;

/**
 * ALL valid block types (server validation accepts any of these in card
 * bodies — including legacy/deprecated types for backward compat).
 */
export const BLOCK_TYPES = [
  // Rich
  "key_concept",
  "micro_story",
  "scenario",
  "before_after",
  "step_by_step",
  "comprehension_check",
  "video_embed",
  // Generic (kept)
  "embed",
  "accordion",
  "gallery",
  // Deprecated (legacy accept)
  "prose",
  "callout",
  "checklist",
  "image",
  "video",
  "worked_example",
  "think_aloud",
  "compare_images",
  "code",
  "side_by_side",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Block types shown in the "Add block" menu. Deprecated types are excluded —
 * they can still render if present in existing bodies, but new authoring
 * reaches for the rich vocabulary only.
 */
export const AUTHORABLE_BLOCK_TYPES: readonly BlockType[] = [
  "key_concept",
  "micro_story",
  "scenario",
  "before_after",
  "step_by_step",
  "comprehension_check",
  "video_embed",
  "embed",
  "accordion",
  "gallery",
] as const;

/**
 * Empty/default block factory — used by BlockEditor when adding a new block.
 * Only authorable types have factories; deprecated types can only appear in
 * legacy bodies read from the DB.
 */
export function emptyBlock(type: BlockType): Block {
  switch (type) {
    case "key_concept":
      return { type: "key_concept", title: "", content: "" };
    case "micro_story":
      return {
        type: "micro_story",
        title: "",
        narrative: "",
        is_real_incident: false,
        analysis_prompts: [{ question: "", reveal_answer: "" }],
        key_lesson: "",
      };
    case "scenario":
      return {
        type: "scenario",
        title: "",
        setup: "",
        branches: [
          { id: "b1", choice_text: "", is_correct: true, feedback: "" },
          { id: "b2", choice_text: "", is_correct: false, feedback: "" },
        ],
      };
    case "before_after":
      return {
        type: "before_after",
        title: "",
        before: { caption: "", hazards: [""] },
        after: { caption: "", principles: [""] },
        key_difference: "",
      };
    case "step_by_step":
      return {
        type: "step_by_step",
        title: "",
        steps: [{ number: 1, instruction: "" }],
      };
    case "comprehension_check":
      return {
        type: "comprehension_check",
        question: "",
        options: ["", ""],
        correct_index: 0,
        feedback_correct: "",
        feedback_wrong: "",
      };
    case "video_embed":
      return { type: "video_embed", url: "" };
    case "embed":
      return { type: "embed", url: "", title: "", aspectRatio: "16:9" };
    case "accordion":
      return { type: "accordion", title: "", body: "" };
    case "gallery":
      return { type: "gallery", images: [{ url: "", caption: "", alt: "" }] };

    // Deprecated — kept for completeness but authoring path never reaches these.
    case "prose":
      return { type: "prose", text: "" };
    case "callout":
      return { type: "callout", tone: "tip", text: "" };
    case "checklist":
      return { type: "checklist", items: [""] };
    case "image":
      return { type: "image", url: "", caption: "", alt: "" };
    case "video":
      return { type: "video", url: "", caption: "" };
    case "worked_example":
      return { type: "worked_example", title: "", steps: [""] };
    case "think_aloud":
      return { type: "think_aloud", prompt: "", answer: "" };
    case "compare_images":
      return {
        type: "compare_images",
        beforeUrl: "",
        afterUrl: "",
        beforeLabel: "Before",
        afterLabel: "After",
      };
    case "code":
      return { type: "code", code: "", language: "" };
    case "side_by_side":
      return {
        type: "side_by_side",
        leftTitle: "",
        leftText: "",
        rightTitle: "",
        rightText: "",
      };
  }
}

/**
 * Safelist of embed domains for iframe render. Anything not in this list is
 * rejected (rendered as a fallback link). Videos should use VideoBlock —
 * this is intentionally excluded here.
 */
export const EMBED_HOSTS = [
  "sketchfab.com",
  "figma.com",
  "codepen.io",
  "miro.com",
  "desmos.com",
  "observablehq.com",
  "geogebra.org",
] as const;

export function isSafeEmbedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return EMBED_HOSTS.some(
      (allowed) => host === allowed || host.endsWith("." + allowed)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Skill card — row shape + derived wrappers
// ============================================================================

/**
 * DofE-inspired progression tier. Replaces the earlier `difficulty` field
 * in migration 110. Research brief principle #3: keep DofE vocabulary
 * verbatim so parents recognise what Gold means.
 *   - bronze = foundational, typical ages 11–13
 *   - silver = applied,      typical ages 13–15
 *   - gold   = transferable, typical ages 15–18
 */
export type SkillTier = "bronze" | "silver" | "gold";

export const SKILL_TIERS: readonly SkillTier[] = ["bronze", "silver", "gold"] as const;

export const SKILL_TIER_LABELS: Record<SkillTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

/**
 * Lesson = standard mixed-blocks body with optional quiz gate.
 * Routine = Project Zero-style thinking routine — a named 3–6 step prompt
 *   run against the student's own work. Different renderer + per-artefact
 *   demo semantics (deferred to S3).
 */
export type CardType = "lesson" | "routine";

/**
 * Framework anchor — one card can map to multiple (ATL + WEF + Studio Habits).
 * Shape kept simple: framework family + specific axis label.
 */
export interface FrameworkAnchor {
  framework: "ATL" | "CASEL" | "WEF" | "StudioHabits";
  label: string; // e.g. "Self-Management", "Responsible Decision-Making", "Analytical Thinking", "Develop Craft"
}

/**
 * Row shape of `skill_cards` (through migration 110).
 *
 * `category_id` FK → skill_categories (8 cognitive-action categories).
 * `domain_id`   FK → skill_domains    (10 subject-area domains).
 * Both are expected on fully-authored cards; either may be null on
 * migration-era legacy rows.
 */
export interface SkillCardRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category_id: string | null;
  domain_id: string | null;
  tier: SkillTier | null;
  age_min: number | null;
  age_max: number | null;
  body: Block[];
  estimated_min: number | null;
  framework_anchors: FrameworkAnchor[];
  demo_of_competency: string | null;
  learning_outcomes: string[];
  applied_in: string[];
  card_type: CardType;
  author_name: string | null;
  // Quiz (migration 112)
  quiz_questions: QuizQuestion[];
  pass_threshold: number;
  retake_cooldown_minutes: number;
  question_count: number | null; // NULL = use full pool
  is_built_in: boolean;
  created_by_teacher_id: string | null;
  is_published: boolean;
  forked_from: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Category lookup row (seeded in 105).
 */
export interface SkillCategoryRow {
  id: string;
  label: string;
  description: string;
  display_order: number;
}

/**
 * Domain lookup row (seeded in 110). Ten subject-area groupings from the
 * v1 catalogue (docs/projects/skills-library-catalogue-v1.md).
 */
export interface SkillDomainRow {
  id: string;           // 'design-making'
  short_code: string;   // 'DM' — used in catalogue card IDs (DM-B1 etc)
  label: string;
  description: string;
  display_order: number;
}

/**
 * External link row — separate table, one-to-many with skill_cards.
 */
export interface SkillExternalLinkRow {
  id: string;
  skill_id: string;
  url: string;
  title: string | null;
  kind: "video" | "pdf" | "doc" | "website" | "other" | null;
  display_order: number;
  last_checked_at: string | null;
  status: "ok" | "broken" | "redirect" | "timeout" | "unchecked" | null;
}

/**
 * Prerequisite edge row.
 */
export interface SkillPrerequisiteRow {
  skill_id: string;
  prerequisite_id: string;
}

/**
 * Fully-hydrated card surface — row plus related collections. The teacher
 * editor and student viewer both consume this shape.
 */
export interface SkillCardHydrated extends SkillCardRow {
  tags: string[];
  external_links: SkillExternalLinkRow[];
  prerequisites: Array<Pick<SkillCardRow, "id" | "slug" | "title" | "tier">>;
}

/**
 * Controlled verbs for the `demo_of_competency` line. Research brief
 * principle #2 ("verbs are sacred") — each has a fixed meaning and is
 * the only vocabulary acceptable as a demo gate. *understand*, *know*,
 * *appreciate*, *be aware of* are explicitly banned — unverifiable.
 */
export const CONTROLLED_VERBS = [
  "show",
  "demonstrate",
  "produce",
  "explain",
  "argue",
  "identify",
  "compare",
  "sketch",
  "make",
  "plan",
  "deliver",
] as const;

export type ControlledVerb = (typeof CONTROLLED_VERBS)[number];

// ============================================================================
// Quiz types — ported from the safety-badges quiz engine (migration 112)
// ============================================================================

/**
 * One question in a skill card's quiz. Shape mirrors the safety
 * BadgeQuestion so the same runner + scoring code can work against both.
 * For Phase A we support the 3 most common types; sequence/match can be
 * added in Phase B if migrating safety content requires them.
 */
export type QuizQuestionType = "multiple_choice" | "true_false" | "scenario";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options?: string[]; // MC + T/F
  /** Correct answer — string for MC index-as-string / T/F answer text,
   *  string[] for multi-select (not used in Phase A), number[] for
   *  sequence (Phase B). Kept as union for shape parity with badges. */
  correct_answer: string | string[] | number[];
  explanation: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
}

/** One student's answer to one question — matches the badge answer shape. */
export interface QuizAnswer {
  question_id: string;
  selected: string | string[] | number[];
  time_ms?: number;
}

/** A graded answer returned by the submit endpoint. */
export interface QuizAnswerResult {
  question_id: string;
  prompt: string;
  correct: boolean;
  explanation: string;
}

export interface QuizSubmitResponse {
  score: number;
  passed: boolean;
  total: number;
  correct: number;
  pass_threshold: number;
  attempt_number: number;
  results: QuizAnswerResult[];
  /** Rate-limited retake: minutes left until the student can try again
   *  after a failed attempt. 0 / undefined = can retry now. */
  retake_after_minutes?: number;
}

/** Live cooldown + state for the intro screen before a student starts. */
export interface QuizStatus {
  has_quiz: boolean;
  question_count: number; // effective count (may be less than pool if question_count set)
  pass_threshold: number;
  retake_cooldown_minutes: number;
  last_attempt_at: string | null;
  attempt_count: number;
  best_score: number | null;
  passed: boolean;
  /** How many more minutes until a retake is allowed (after a fail). */
  cooldown_remaining_minutes: number;
}

// ============================================================================
// Event types — consumed by learning_events (migration 106)
// ============================================================================

export const SKILL_EVENT_TYPES = [
  "skill.viewed",
  "skill.quiz_passed",
  "skill.quiz_failed",
  "skill.demonstrated",
  "skill.applied",
  "skill.refresh_acknowledged",
  "skill.refresh_passed",
] as const;

export type SkillEventType = (typeof SKILL_EVENT_TYPES)[number];

// ============================================================================
// Write-side payloads (shared between client + server)
// ============================================================================

type ExternalLinkInput = {
  url: string;
  title?: string;
  kind?: SkillExternalLinkRow["kind"];
};

/**
 * Create payload for a new skill card. tier + domain_id are required so
 * every new card is catalogue-ready. category_id stays required so the
 * cognitive-action taxonomy coverage holds.
 *
 * Optional-but-strongly-recommended fields (age band, framework anchors,
 * demo of competency, learning outcomes, applied in) are not required on
 * initial create — the teacher can draft the card and fill these in over
 * time — but publishing should validate they're present.
 */
export interface CreateSkillCardPayload {
  slug: string;
  title: string;
  summary?: string;
  category_id: string;
  domain_id: string;
  tier: SkillTier;
  body: Block[];
  estimated_min?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  framework_anchors?: FrameworkAnchor[];
  demo_of_competency?: string | null;
  learning_outcomes?: string[];
  applied_in?: string[];
  card_type?: CardType;
  author_name?: string | null;
  tags?: string[];
  external_links?: ExternalLinkInput[];
  prerequisite_ids?: string[];
  // Quiz (migration 112) — optional; empty/absent = no quiz on this card.
  quiz_questions?: QuizQuestion[];
  pass_threshold?: number;
  retake_cooldown_minutes?: number;
  question_count?: number | null;
}

export interface UpdateSkillCardPayload {
  title?: string;
  summary?: string | null;
  category_id?: string;
  domain_id?: string;
  tier?: SkillTier;
  body?: Block[];
  estimated_min?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  framework_anchors?: FrameworkAnchor[];
  demo_of_competency?: string | null;
  learning_outcomes?: string[];
  applied_in?: string[];
  card_type?: CardType;
  author_name?: string | null;
  tags?: string[];
  external_links?: ExternalLinkInput[];
  prerequisite_ids?: string[];
  // Quiz (migration 112)
  quiz_questions?: QuizQuestion[];
  pass_threshold?: number;
  retake_cooldown_minutes?: number;
  question_count?: number | null;
}
