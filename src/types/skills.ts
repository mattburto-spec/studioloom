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

export type Block =
  | ProseBlock
  | CalloutBlock
  | ChecklistBlock
  | ImageBlock
  | VideoBlock
  | WorkedExampleBlock;

export const BLOCK_TYPES = [
  "prose",
  "callout",
  "checklist",
  "image",
  "video",
  "worked_example",
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
