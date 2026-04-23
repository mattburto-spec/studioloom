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

export type SkillDifficulty = "foundational" | "intermediate" | "advanced";

/**
 * Row shape of `skill_cards` (migration 105 + 109).
 */
export interface SkillCardRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category_id: string | null;
  difficulty: SkillDifficulty | null;
  body: Block[];
  estimated_min: number | null;
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
  prerequisites: Array<Pick<SkillCardRow, "id" | "slug" | "title" | "difficulty">>;
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

export interface CreateSkillCardPayload {
  slug: string;
  title: string;
  summary?: string;
  category_id: string;
  difficulty: SkillDifficulty;
  body: Block[];
  estimated_min?: number | null;
  tags?: string[];
  external_links?: Array<{
    url: string;
    title?: string;
    kind?: SkillExternalLinkRow["kind"];
  }>;
  prerequisite_ids?: string[];
}

export interface UpdateSkillCardPayload {
  title?: string;
  summary?: string | null;
  category_id?: string;
  difficulty?: SkillDifficulty;
  body?: Block[];
  estimated_min?: number | null;
  tags?: string[];
  external_links?: Array<{
    url: string;
    title?: string;
    kind?: SkillExternalLinkRow["kind"];
  }>;
  prerequisite_ids?: string[];
}
