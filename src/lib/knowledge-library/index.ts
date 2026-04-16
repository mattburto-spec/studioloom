/**
 * Data access layer for the Knowledge Library.
 *
 * All DB queries go through here. Follows the same pattern as
 * `src/lib/activity-cards/index.ts`.
 *
 * Knowledge items are browsable resources that sit above RAG chunks.
 * Each item can generate chunks for AI retrieval via `generateItemChunks()`.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, embedAll } from "@/lib/ai/embeddings";
import { chunkDocument, type ChunkMetadata } from "@/lib/knowledge/chunk";
import type { ExtractedDoc } from "@/lib/ingestion/document-extract";
import type {
  KnowledgeItem,
  KnowledgeItemWithCurricula,
  KnowledgeItemCurriculum,
  KnowledgeItemLink,
  KnowledgeItemFilters,
  KnowledgeItemContent,
  TutorialContent,
  ChoiceBoardContent,
  ReferenceContent,
  SkillGuideContent,
  TextbookSectionContent,
  LessonResourceContent,
  MediaContent,
  DisplayMode,
  LinkType,
} from "@/types/knowledge-library";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// List / filter items
// ---------------------------------------------------------------------------

export async function getKnowledgeItems(
  teacherId: string,
  filters?: KnowledgeItemFilters
): Promise<KnowledgeItem[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("knowledge_items")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("updated_at", { ascending: false });

  // Default: hide archived
  if (filters?.is_archived !== undefined) {
    query = query.eq("is_archived", filters.is_archived);
  } else {
    query = query.eq("is_archived", false);
  }

  if (filters?.item_type) {
    query = query.eq("item_type", filters.item_type);
  }
  if (filters?.tags && filters.tags.length > 0) {
    query = query.contains("tags", filters.tags);
  }
  if (filters?.search) {
    query = query.textSearch("fts", filters.search, {
      type: "websearch",
      config: "english",
    });
  }

  const { data, error } = await query;

  if (error) {
    console.error("[knowledge-library] List error:", error.message);
    return [];
  }

  return (data || []) as KnowledgeItem[];
}

// ---------------------------------------------------------------------------
// Get single item (with curricula)
// ---------------------------------------------------------------------------

export async function getKnowledgeItemById(
  id: string
): Promise<KnowledgeItemWithCurricula | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*, knowledge_item_curricula(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[knowledge-library] Fetch error:", error.message);
    return null;
  }

  return data as KnowledgeItemWithCurricula;
}

// ---------------------------------------------------------------------------
// Semantic search (hybrid: embedding + FTS + usage)
// ---------------------------------------------------------------------------

export async function searchKnowledgeItems(
  query: string,
  teacherId: string,
  filters?: KnowledgeItemFilters,
  maxResults = 20
): Promise<KnowledgeItem[]> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch (err) {
    console.warn("[knowledge-library] Embedding failed, falling back to FTS:", err);
    return getKnowledgeItems(teacherId, { ...filters, search: query });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_knowledge_items", {
    query_embedding: `[${queryEmbedding.join(",")}]`,
    query_text: query,
    match_count: maxResults,
    filter_type: filters?.item_type || null,
    filter_tags: filters?.tags && filters.tags.length > 0 ? filters.tags : null,
    filter_framework: filters?.framework || null,
    filter_teacher_id: teacherId,
    include_public: true,
  });

  if (error) {
    console.error("[knowledge-library] Search error:", error.message);
    return [];
  }

  return (data || []) as KnowledgeItem[];
}

// ---------------------------------------------------------------------------
// Create item
// ---------------------------------------------------------------------------

export async function createKnowledgeItem(
  data: {
    title: string;
    description?: string;
    item_type: string;
    tags?: string[];
    content?: KnowledgeItemContent;
    source_type?: string;
    source_upload_id?: string;
    source_unit_id?: string;
    thumbnail_url?: string;
    media_url?: string;
    is_public?: boolean;
    collection?: string;
    curricula?: Omit<KnowledgeItemCurriculum, "id" | "item_id">[];
  },
  teacherId: string
): Promise<KnowledgeItem | null> {
  const supabase = createAdminClient();

  // Generate unique slug
  let slug = slugify(data.title);
  const { count } = await supabase
    .from("knowledge_items")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .eq("slug", slug);

  if (count && count > 0) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const { data: item, error } = await supabase
    .from("knowledge_items")
    .insert({
      title: data.title,
      slug,
      description: data.description || "",
      item_type: data.item_type,
      tags: data.tags || [],
      content: data.content || {},
      source_type: data.source_type || "manual",
      source_upload_id: data.source_upload_id || null,
      source_unit_id: data.source_unit_id || null,
      teacher_id: teacherId,
      thumbnail_url: data.thumbnail_url || null,
      media_url: data.media_url || null,
      is_public: data.is_public || false,
      ...(data.collection && { collection: data.collection }),
    })
    .select()
    .single();

  if (error) {
    console.error("[knowledge-library] Create error:", error.message);
    return null;
  }

  const created = item as KnowledgeItem;

  // Insert curricula if provided
  if (data.curricula && data.curricula.length > 0) {
    const curricRows = data.curricula.map((c) => ({
      item_id: created.id,
      framework: c.framework,
      criteria: c.criteria || [],
      strand: c.strand || null,
      topic: c.topic || null,
      year_group: c.year_group || null,
      textbook_ref: c.textbook_ref || null,
    }));

    const { error: curricError } = await supabase
      .from("knowledge_item_curricula")
      .insert(curricRows);

    if (curricError) {
      console.error("[knowledge-library] Curricula insert error:", curricError.message);
    }
  }

  // Fire-and-forget: generate embedding
  generateEmbedding(created.id, created.title, created.description).catch(() => {});

  return created;
}

// ---------------------------------------------------------------------------
// Update item
// ---------------------------------------------------------------------------

export async function updateKnowledgeItem(
  id: string,
  updates: {
    title?: string;
    description?: string;
    item_type?: string;
    tags?: string[];
    content?: KnowledgeItemContent;
    thumbnail_url?: string;
    media_url?: string;
    is_public?: boolean;
    is_archived?: boolean;
  },
  teacherId: string
): Promise<KnowledgeItem | null> {
  const supabase = createAdminClient();

  // Ownership check
  const { data: existing } = await supabase
    .from("knowledge_items")
    .select("id, title, description")
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .single();

  if (!existing) {
    console.error("[knowledge-library] Update: item not found or not owned");
    return null;
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.item_type !== undefined) updateData.item_type = updates.item_type;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.thumbnail_url !== undefined) updateData.thumbnail_url = updates.thumbnail_url;
  if (updates.media_url !== undefined) updateData.media_url = updates.media_url;
  if (updates.is_public !== undefined) updateData.is_public = updates.is_public;
  if (updates.is_archived !== undefined) updateData.is_archived = updates.is_archived;

  const { data: updated, error } = await supabase
    .from("knowledge_items")
    .update(updateData)
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .select()
    .single();

  if (error) {
    console.error("[knowledge-library] Update error:", error.message);
    return null;
  }

  const result = updated as KnowledgeItem;

  // Re-embed if title or description changed
  const titleChanged = updates.title && updates.title !== existing.title;
  const descChanged = updates.description && updates.description !== existing.description;
  if (titleChanged || descChanged) {
    generateEmbedding(result.id, result.title, result.description).catch(() => {});
  }

  return result;
}

// ---------------------------------------------------------------------------
// Delete item
// ---------------------------------------------------------------------------

export async function deleteKnowledgeItem(
  id: string,
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // Legacy write flagged for Dimensions3 phase TBD (Phase 0.4 audit, 10 Apr 2026).
  // Knowledge items can still be deleted by teachers; the chunk cleanup is
  // cascade-style and harmless for the new pipeline. Revisit when legacy
  // knowledge_chunks is fully drained.
  // Delete associated chunks first
  await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("item_id", id);

  // Delete item (cascades to curricula and links)
  const { error } = await supabase
    .from("knowledge_items")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("[knowledge-library] Delete error:", error.message);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Curriculum mappings
// ---------------------------------------------------------------------------

export async function setItemCurricula(
  itemId: string,
  curricula: Omit<KnowledgeItemCurriculum, "id" | "item_id">[]
): Promise<boolean> {
  const supabase = createAdminClient();

  // Delete existing
  await supabase
    .from("knowledge_item_curricula")
    .delete()
    .eq("item_id", itemId);

  if (curricula.length === 0) return true;

  // Insert new
  const rows = curricula.map((c) => ({
    item_id: itemId,
    framework: c.framework,
    criteria: c.criteria || [],
    strand: c.strand || null,
    topic: c.topic || null,
    year_group: c.year_group || null,
    textbook_ref: c.textbook_ref || null,
  }));

  const { error } = await supabase
    .from("knowledge_item_curricula")
    .insert(rows);

  if (error) {
    console.error("[knowledge-library] Set curricula error:", error.message);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Linking items to unit pages
// ---------------------------------------------------------------------------

export async function linkItemToPage(params: {
  itemId: string;
  unitId: string;
  pageId: string;
  linkType?: LinkType;
  displayMode?: DisplayMode;
  sortOrder?: number;
  teacherId: string;
}): Promise<KnowledgeItemLink | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("knowledge_item_links")
    .upsert(
      {
        item_id: params.itemId,
        unit_id: params.unitId,
        page_id: params.pageId,
        link_type: params.linkType || "reference",
        display_mode: params.displayMode || "sidebar",
        sort_order: params.sortOrder || 0,
        teacher_id: params.teacherId,
      },
      { onConflict: "item_id,unit_id,page_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[knowledge-library] Link error:", error.message);
    return null;
  }

  // Increment link count (fire-and-forget)
  supabase
    .rpc("increment_item_link", { item_uuid: params.itemId })
    .then(({ error: rpcErr }) => {
      if (rpcErr) console.error("[knowledge-library] Link count error:", rpcErr.message);
    });

  return data as KnowledgeItemLink;
}

export async function unlinkItem(
  itemId: string,
  unitId: string,
  pageId: string,
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("knowledge_item_links")
    .delete()
    .eq("item_id", itemId)
    .eq("unit_id", unitId)
    .eq("page_id", pageId)
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("[knowledge-library] Unlink error:", error.message);
    return false;
  }

  return true;
}

export async function getLinkedItems(
  unitId: string,
  pageId?: string
): Promise<(KnowledgeItemLink & { knowledge_items: KnowledgeItem })[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("knowledge_item_links")
    .select("*, knowledge_items(*)")
    .eq("unit_id", unitId)
    .order("sort_order");

  if (pageId) {
    query = query.eq("page_id", pageId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[knowledge-library] Get linked items error:", error.message);
    return [];
  }

  return (data || []) as (KnowledgeItemLink & { knowledge_items: KnowledgeItem })[];
}

// ---------------------------------------------------------------------------
// Tags (for autocomplete)
// ---------------------------------------------------------------------------

export async function getItemTags(teacherId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .rpc("get_knowledge_item_tags" as never, { p_teacher_id: teacherId });

  if (error) {
    // Fallback: query directly (RPC might not exist yet)
    const { data: items } = await supabase
      .from("knowledge_items")
      .select("tags")
      .eq("teacher_id", teacherId)
      .eq("is_archived", false);

    if (!items) return [];

    const tagSet = new Set<string>();
    for (const item of items) {
      const tags = (item as { tags: string[] }).tags;
      if (tags) {
        for (const tag of tags) tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }

  return (data || []) as string[];
}

// ---------------------------------------------------------------------------
// Generate embedding for an item (fire-and-forget)
// ---------------------------------------------------------------------------

async function generateEmbedding(
  itemId: string,
  title: string,
  description: string
): Promise<void> {
  try {
    const text = `${title}\n${description}`.trim();
    const embedding = await embedText(text);

    const supabase = createAdminClient();
    await supabase
      .from("knowledge_items")
      .update({ embedding: `[${embedding.join(",")}]` })
      .eq("id", itemId);
  } catch (err) {
    console.warn("[knowledge-library] Embedding failed for item:", itemId, err);
    // Non-fatal: item works without embedding, just won't appear in semantic search
  }
}

// ---------------------------------------------------------------------------
// Generate RAG chunks from a knowledge item
// ---------------------------------------------------------------------------

/**
 * Creates RAG-ready chunks from a knowledge item's structured content.
 * Deletes any existing chunks for this item, then creates new ones.
 *
 * This bridges the Knowledge Library (browsable) with the RAG pipeline (searchable).
 */
// Legacy write flagged for Dimensions3 phase TBD (Phase 0.4 audit, 10 Apr 2026).
// generateItemChunks bridges the Knowledge Library (knowledge_items) with the
// legacy RAG store (knowledge_chunks). Still called from knowledge item
// create/update flows. Cutover to activity_blocks / content_items is a
// Dimensions3 follow-on, not Phase 0 scope.
export async function generateItemChunks(item: KnowledgeItem): Promise<number> {
  const supabase = createAdminClient();

  // 1. Delete existing chunks for this item
  await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("item_id", item.id);

  // 2. Build text content from structured JSONB
  const textContent = extractTextFromContent(item.item_type, item.content);
  if (!textContent || textContent.length < 100) {
    return 0; // Too little content to chunk
  }

  // 3. Build ExtractedDoc for the chunking pipeline
  const doc: ExtractedDoc = {
    title: item.title,
    sections: buildSectionsFromContent(item.item_type, item.content, item.title),
    rawText: textContent,
  };

  // 4. Chunk using existing pipeline
  const metadata: ChunkMetadata = {
    source_type: "knowledge_item",
    source_id: item.id,
    teacher_id: item.teacher_id,
    is_public: item.is_public,
  };

  const chunks = chunkDocument(doc, metadata);

  // Set item_id on all chunks
  for (const chunk of chunks) {
    chunk.item_id = item.id;
    chunk.context_preamble = `Knowledge Item: ${item.title} (${item.item_type})\nTags: ${item.tags.join(", ")}`;
  }

  if (chunks.length === 0) return 0;

  // 5. Generate embeddings
  let embeddings: number[][] = [];
  try {
    embeddings = await embedAll(chunks.map((c) => c.content));
  } catch (err) {
    console.warn("[knowledge-library] Chunk embedding failed:", err);
    // Store chunks without embeddings — they'll still work for FTS
  }

  // 6. Insert into knowledge_chunks
  const rows = chunks.map((chunk, i) => ({
    content: chunk.content,
    context_preamble: chunk.context_preamble || null,
    criterion: chunk.criterion || null,
    page_id: chunk.page_id || null,
    content_type: chunk.content_type || "instruction",
    source_type: chunk.metadata.source_type,
    source_id: chunk.metadata.source_id || null,
    teacher_id: chunk.metadata.teacher_id || null,
    is_public: chunk.metadata.is_public || false,
    item_id: chunk.item_id || null,
    embedding: embeddings[i] ? `[${embeddings[i].join(",")}]` : null,
  }));

  const { error } = await supabase
    .from("knowledge_chunks")
    .insert(rows);

  if (error) {
    console.error("[knowledge-library] Chunk insert error:", error.message);
    return 0;
  }

  return chunks.length;
}

// ---------------------------------------------------------------------------
// Content → text extraction (for chunking)
// ---------------------------------------------------------------------------

function extractTextFromContent(
  itemType: string,
  content: KnowledgeItemContent
): string {
  switch (itemType) {
    case "tutorial": {
      const c = content as TutorialContent;
      if (!c.steps) return "";
      return c.steps
        .map((s, i) => `Step ${i + 1}: ${s.title}\n${s.instruction}`)
        .join("\n\n");
    }
    case "choice-board": {
      const c = content as ChoiceBoardContent;
      if (!c.tasks) return "";
      const intro = c.instructions ? `${c.instructions}\n\n` : "";
      return (
        intro +
        c.tasks
          .map((t) => `${t.label}: ${t.description}${t.materials ? ` (Materials: ${t.materials})` : ""}`)
          .join("\n")
      );
    }
    case "reference": {
      const c = content as ReferenceContent;
      return c.body || "";
    }
    case "skill-guide": {
      const c = content as SkillGuideContent;
      const steps = c.steps
        ? c.steps.map((s, i) => `Step ${i + 1}: ${s.title}\n${s.description}`).join("\n\n")
        : "";
      const safety = c.safety_notes ? `\nSafety Notes:\n${c.safety_notes.join("\n")}` : "";
      return steps + safety;
    }
    case "textbook-section": {
      const c = content as TextbookSectionContent;
      const header = c.chapter ? `Chapter: ${c.chapter}` : "";
      const points = c.key_points ? c.key_points.join("\n") : "";
      const questions = c.questions ? `\nQuestions:\n${c.questions.join("\n")}` : "";
      return [header, points, questions].filter(Boolean).join("\n\n");
    }
    case "lesson-resource": {
      const c = content as LessonResourceContent;
      return c.notes || "";
    }
    case "image":
    case "video":
    case "audio": {
      const c = content as MediaContent;
      return [c.alt_text, c.caption].filter(Boolean).join("\n");
    }
    default:
      return JSON.stringify(content);
  }
}

function buildSectionsFromContent(
  itemType: string,
  content: KnowledgeItemContent,
  title: string
): { heading: string; content: string }[] {
  switch (itemType) {
    case "tutorial": {
      const c = content as TutorialContent;
      if (!c.steps) return [{ heading: title, content: "" }];
      return c.steps.map((s) => ({
        heading: s.title,
        content: s.instruction,
      }));
    }
    case "choice-board": {
      const c = content as ChoiceBoardContent;
      if (!c.tasks) return [{ heading: title, content: "" }];
      return c.tasks.map((t) => ({
        heading: t.label,
        content: `${t.description}${t.materials ? ` | Materials: ${t.materials}` : ""}`,
      }));
    }
    case "skill-guide": {
      const c = content as SkillGuideContent;
      const sections = c.steps
        ? c.steps.map((s) => ({ heading: s.title, content: s.description }))
        : [];
      if (c.safety_notes && c.safety_notes.length > 0) {
        sections.push({ heading: "Safety Notes", content: c.safety_notes.join("\n") });
      }
      return sections;
    }
    default: {
      // Single-section for simple content types
      const text = extractTextFromContent(itemType, content);
      return [{ heading: title, content: text }];
    }
  }
}
