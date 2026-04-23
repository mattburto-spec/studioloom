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
// ============================================================================

export type ProseBlock = {
  type: "prose";
  text: string; // markdown-lite; renderer handles **bold**, *italic*, line breaks
};

export type CalloutBlock = {
  type: "callout";
  tone: "tip" | "warning" | "note";
  text: string;
};

export type ChecklistBlock = {
  type: "checklist";
  items: string[];
};

export type ImageBlock = {
  type: "image";
  url: string; // external URL in S2A; S2B may set uploadPath instead
  caption?: string;
  alt?: string;
  uploadPath?: string; // S2B — Supabase Storage key, overrides url when present
};

export type VideoBlock = {
  type: "video";
  url: string; // YouTube / Vimeo / direct mp4 in S2A
  caption?: string;
  uploadPath?: string; // S2B — Supabase Storage key
};

export type WorkedExampleBlock = {
  type: "worked_example";
  title: string;
  steps: string[]; // rendered as ordered list
};

// ----- Rich blocks (S2A.5 batch) -----------------------------------------

/**
 * Generic iframe embed. Domain-safelisted at render time (Sketchfab, Figma,
 * Codepen, Miro, Desmos, Observable, GeoGebra). Keep videos in VideoBlock.
 */
export type EmbedBlock = {
  type: "embed";
  url: string;
  title?: string; // iframe title for a11y; also shown as caption
  aspectRatio?: "16:9" | "4:3" | "1:1";
  caption?: string;
};

/** Click-to-reveal collapsible. Body is markdown-lite like prose. */
export type AccordionBlock = {
  type: "accordion";
  title: string;
  body: string;
};

/** Question shown; answer hidden behind a reveal button. Supports self-test. */
export type ThinkAloudBlock = {
  type: "think_aloud";
  prompt: string;
  answer: string;
};

/** Before/after draggable slider. Both images must render at the same aspect. */
export type CompareImagesBlock = {
  type: "compare_images";
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  caption?: string;
};

/** Paginated image gallery (one-at-a-time with prev/next + dots). */
export type GalleryBlock = {
  type: "gallery";
  images: Array<{ url: string; caption?: string; alt?: string }>;
};

/** Code snippet. Displayed monospace; language label only (no highlighting yet). */
export type CodeBlockBlock = {
  type: "code";
  code: string;
  language?: string;
  filename?: string;
};

/** Two columns of markdown-lite — compare good/bad, material A/B, etc. */
export type SideBySideBlock = {
  type: "side_by_side";
  leftTitle?: string;
  leftText: string;
  rightTitle?: string;
  rightText: string;
};

export type Block =
  | ProseBlock
  | CalloutBlock
  | ChecklistBlock
  | ImageBlock
  | VideoBlock
  | WorkedExampleBlock
  | EmbedBlock
  | AccordionBlock
  | ThinkAloudBlock
  | CompareImagesBlock
  | GalleryBlock
  | CodeBlockBlock
  | SideBySideBlock;

export const BLOCK_TYPES = [
  "prose",
  "callout",
  "checklist",
  "image",
  "video",
  "worked_example",
  "embed",
  "accordion",
  "think_aloud",
  "compare_images",
  "gallery",
  "code",
  "side_by_side",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Empty/default block factory — used by BlockEditor when adding a new block.
 */
export function emptyBlock(type: BlockType): Block {
  switch (type) {
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
    case "embed":
      return { type: "embed", url: "", title: "", aspectRatio: "16:9" };
    case "accordion":
      return { type: "accordion", title: "", body: "" };
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
    case "gallery":
      return { type: "gallery", images: [{ url: "", caption: "", alt: "" }] };
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
}
