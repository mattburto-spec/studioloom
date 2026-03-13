/**
 * Knowledge Library types.
 *
 * Knowledge items are browsable, teacher-curated resources that sit above
 * the RAG chunk layer. Each item generates chunks for AI retrieval while
 * remaining a coherent, browsable entity for teachers and students.
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type KnowledgeItemType =
  | "tutorial"
  | "choice-board"
  | "reference"
  | "skill-guide"
  | "textbook-section"
  | "lesson-resource"
  | "image"
  | "video"
  | "audio"
  | "other";

export type KnowledgeSourceType = "manual" | "upload" | "unit" | "ai_generated";

export type LinkType = "reference" | "activity" | "resource" | "extension";

export type DisplayMode = "sidebar" | "inline" | "choice-board";

// ---------------------------------------------------------------------------
// Content shapes (one per item_type, stored in content JSONB)
// ---------------------------------------------------------------------------

export interface TutorialStep {
  title: string;
  instruction: string;
  media_url?: string;
}

export interface TutorialContent {
  steps: TutorialStep[];
  estimated_time_minutes?: number;
}

export interface ChoiceBoardTask {
  id: string;
  label: string;
  description: string;
  difficulty?: string;
  materials?: string;
  duration?: string;
  link?: string;
}

export interface ChoiceBoardContent {
  tasks: ChoiceBoardTask[];
  instructions?: string;
  minSelections?: number;
  maxSelections?: number;
}

export interface ReferenceContent {
  body: string; // markdown
  source_url?: string;
}

export interface SkillGuideStep {
  title: string;
  description: string;
  tip?: string;
}

export interface SkillGuideContent {
  steps: SkillGuideStep[];
  safety_notes?: string[];
  prerequisites?: string[];
}

export interface TextbookSectionContent {
  chapter?: string;
  page_range?: string;
  key_points: string[];
  questions?: string[];
}

export interface LessonResourceContent {
  resource_url?: string;
  embed_type?: "video" | "iframe" | "link";
  notes?: string;
}

export interface MediaContent {
  url: string;
  alt_text?: string;
  caption?: string;
  duration_seconds?: number; // for video/audio
}

/** Union of all possible content shapes. */
export type KnowledgeItemContent =
  | TutorialContent
  | ChoiceBoardContent
  | ReferenceContent
  | SkillGuideContent
  | TextbookSectionContent
  | LessonResourceContent
  | MediaContent
  | Record<string, unknown>;

// ---------------------------------------------------------------------------
// Core entities (mirror DB rows)
// ---------------------------------------------------------------------------

export interface KnowledgeItemCounters {
  times_linked: number;
  times_viewed: number;
  avg_rating: number | null;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  item_type: KnowledgeItemType;
  tags: string[];
  content: KnowledgeItemContent;
  source_type: KnowledgeSourceType;
  source_upload_id: string | null;
  source_unit_id: string | null;
  teacher_id: string;
  counters: KnowledgeItemCounters;
  thumbnail_url: string | null;
  media_url: string | null;
  is_public: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeItemCurriculum {
  id: string;
  item_id: string;
  framework: string;
  criteria: string[];
  strand: string | null;
  topic: string | null;
  year_group: string | null;
  textbook_ref: string | null;
}

export interface KnowledgeItemLink {
  id: string;
  item_id: string;
  unit_id: string;
  page_id: string;
  link_type: LinkType;
  display_mode: DisplayMode;
  sort_order: number;
  teacher_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Item with joined curricula (returned by getKnowledgeItemById)
// ---------------------------------------------------------------------------

export interface KnowledgeItemWithCurricula extends KnowledgeItem {
  knowledge_item_curricula: KnowledgeItemCurriculum[];
}

// ---------------------------------------------------------------------------
// Filter / request types
// ---------------------------------------------------------------------------

export interface KnowledgeItemFilters {
  item_type?: KnowledgeItemType;
  tags?: string[];
  framework?: string;
  search?: string;
  is_archived?: boolean;
}

export interface CreateKnowledgeItemRequest {
  title: string;
  description?: string;
  item_type: KnowledgeItemType;
  tags?: string[];
  content?: KnowledgeItemContent;
  source_type?: KnowledgeSourceType;
  source_upload_id?: string;
  source_unit_id?: string;
  thumbnail_url?: string;
  media_url?: string;
  is_public?: boolean;
  curricula?: Omit<KnowledgeItemCurriculum, "id" | "item_id">[];
}

export interface UpdateKnowledgeItemRequest {
  title?: string;
  description?: string;
  item_type?: KnowledgeItemType;
  tags?: string[];
  content?: KnowledgeItemContent;
  thumbnail_url?: string;
  media_url?: string;
  is_public?: boolean;
  is_archived?: boolean;
}
