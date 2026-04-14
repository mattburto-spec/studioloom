/**
 * Activity Block Store — Dimensions2
 *
 * Database operations for Activity Blocks: create, batch insert,
 * and embedding generation. Used by both extraction (Phase 1B/1C)
 * and manual creation (Phase 1D).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateActivityBlockParams, ActivityBlock } from "@/types";

/**
 * Insert a batch of Activity Blocks with embeddings.
 * Uses Voyage AI for vector embeddings and stores in activity_blocks table.
 *
 * @returns Array of inserted block IDs
 */
export async function insertActivityBlocks(
  supabase: SupabaseClient,
  teacherId: string,
  blocks: CreateActivityBlockParams[]
): Promise<string[]> {
  if (blocks.length === 0) return [];

  // Generate embeddings for all blocks in batch
  const textsToEmbed = blocks.map(
    (b) => `${b.title}. ${b.description || ""} ${b.prompt}`.trim()
  );

  let embeddings: number[][] | null = null;
  try {
    const { embedAll } = await import("@/lib/ai/embeddings");
    embeddings = await embedAll(textsToEmbed);
  } catch (err) {
    console.warn("[activity-blocks] Embedding generation failed, inserting without vectors:", err);
  }

  // Build rows
  const rows = blocks.map((block, i) => ({
    teacher_id: teacherId,
    title: block.title,
    description: block.description || null,
    prompt: block.prompt,
    source_type: block.source_type,
    source_upload_id: block.source_upload_id || null,
    source_unit_id: block.source_unit_id || null,
    source_page_id: block.source_page_id || null,
    source_activity_index: block.source_activity_index ?? null,
    bloom_level: block.bloom_level || null,
    time_weight: block.time_weight || "moderate",
    grouping: block.grouping || "individual",
    ai_rules: block.ai_rules || null,
    udl_checkpoints: block.udl_checkpoints || null,
    success_look_fors: block.success_look_fors || null,
    design_phase: block.design_phase || null,
    lesson_structure_role: block.lesson_structure_role || null,
    response_type: block.response_type || null,
    toolkit_tool_id: block.toolkit_tool_id || null,
    criterion_tags: block.criterion_tags || null,
    materials_needed: block.materials_needed || null,
    scaffolding: block.scaffolding || null,
    example_response: block.example_response || null,
    tags: block.tags || null,
    is_public: block.is_public || false,
    embedding: embeddings?.[i] ? JSON.stringify(embeddings[i]) : null,
  }));

  // Insert in batches of 50 (Supabase REST API limit)
  const BATCH_SIZE = 50;
  const insertedIds: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("activity_blocks")
      .insert(batch)
      .select("id");

    if (error) {
      console.error("[activity-blocks] Insert batch failed:", error);
      // Continue with remaining batches — partial success is OK
      continue;
    }

    if (data) {
      insertedIds.push(...data.map((d: { id: string }) => d.id));
    }
  }

  return insertedIds;
}

/**
 * Insert a single Activity Block. Convenience wrapper.
 */
export async function insertActivityBlock(
  supabase: SupabaseClient,
  teacherId: string,
  block: CreateActivityBlockParams
): Promise<string | null> {
  const ids = await insertActivityBlocks(supabase, teacherId, [block]);
  return ids[0] || null;
}

/**
 * Get a single Activity Block by ID.
 */
export async function getActivityBlock(
  supabase: SupabaseClient,
  blockId: string
): Promise<ActivityBlock | null> {
  const { data, error } = await supabase
    .from("activity_blocks")
    .select("*")
    .eq("id", blockId)
    .maybeSingle();

  if (error) {
    console.error("[activity-blocks] Get block failed:", error);
    return null;
  }
  return data as ActivityBlock | null;
}

/**
 * List Activity Blocks for a teacher (paginated).
 */
export async function listActivityBlocks(
  supabase: SupabaseClient,
  teacherId: string,
  options: {
    limit?: number;
    offset?: number;
    sourceType?: string;
    isArchived?: boolean;
    /** When true, only return teacher_verified blocks OR manual blocks */
    verified?: boolean;
  } = {}
): Promise<{ blocks: ActivityBlock[]; count: number }> {
  const { limit = 50, offset = 0, sourceType, isArchived = false, verified } = options;

  let query = supabase
    .from("activity_blocks")
    .select("*", { count: "exact" })
    .eq("teacher_id", teacherId)
    .eq("is_archived", isArchived)
    .order("efficacy_score", { ascending: false })
    .range(offset, offset + limit - 1);

  if (sourceType) {
    query = query.eq("source_type", sourceType);
  }

  if (verified) {
    // Include manually created blocks (always trusted) + teacher-verified extracted blocks
    query = query.or("teacher_verified.eq.true,source_type.eq.manual");
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[activity-blocks] List failed:", error);
    return { blocks: [], count: 0 };
  }

  return {
    blocks: (data as ActivityBlock[]) || [],
    count: count || 0,
  };
}

/**
 * Delete Activity Blocks by source upload ID.
 * Used when a knowledge upload is re-processed or deleted.
 */
export async function deleteBlocksByUpload(
  supabase: SupabaseClient,
  uploadId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("activity_blocks")
    .delete()
    .eq("source_upload_id", uploadId)
    .select("id");

  if (error) {
    console.error("[activity-blocks] Delete by upload failed:", error);
    return 0;
  }
  return data?.length || 0;
}

/**
 * Delete Activity Blocks by source unit ID.
 * Used when a unit is re-ingested.
 */
export async function deleteBlocksByUnit(
  supabase: SupabaseClient,
  unitId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("activity_blocks")
    .delete()
    .eq("source_unit_id", unitId)
    .select("id");

  if (error) {
    console.error("[activity-blocks] Delete by unit failed:", error);
    return 0;
  }
  return data?.length || 0;
}

/**
 * Retrieve Activity Blocks using hybrid scoring.
 *
 * Scoring formula:
 *   0.50 * vector_similarity    (semantic match)
 * + 0.20 * efficacy_normalized  (proven quality)
 * + 0.15 * text_match           (keyword overlap)
 * + 0.15 * usage_signal         (community validation)
 *
 * Pre-filters by teacher (own + public), then applies optional
 * dimension filters (bloom, phase, grouping, etc.)
 */
export async function retrieveActivityBlocks(
  supabase: SupabaseClient,
  params: import("./types").BlockRetrievalParams
): Promise<import("./types").RetrievedBlock[]> {
  const {
    query,
    teacherId,
    bloomLevel,
    designPhase,
    timeWeight,
    grouping,
    responseType,
    lessonStructureRole,
    maxBlocks = 10,
    minEfficacy = 0,
    excludeBlockIds = [],
  } = params;

  // Generate query embedding
  let queryEmbedding: number[] | null = null;
  try {
    const { embedText } = await import("@/lib/ai/embeddings");
    queryEmbedding = await embedText(query);
  } catch (err) {
    console.warn("[activity-blocks] Query embedding failed:", err);
  }

  // Build base query — own blocks + public blocks, not archived
  let dbQuery = supabase
    .from("activity_blocks")
    .select("*")
    .eq("is_archived", false)
    .or(`teacher_id.eq.${teacherId},is_public.eq.true`);

  // Apply dimension filters
  if (bloomLevel) dbQuery = dbQuery.eq("bloom_level", bloomLevel);
  if (designPhase) dbQuery = dbQuery.eq("design_phase", designPhase);
  if (timeWeight) dbQuery = dbQuery.eq("time_weight", timeWeight);
  if (grouping) dbQuery = dbQuery.eq("grouping", grouping);
  if (responseType) dbQuery = dbQuery.eq("response_type", responseType);
  if (lessonStructureRole) dbQuery = dbQuery.eq("lesson_structure_role", lessonStructureRole);
  if (minEfficacy > 0) dbQuery = dbQuery.gte("efficacy_score", minEfficacy);

  // Exclude specific block IDs (already used in this unit)
  if (excludeBlockIds.length > 0) {
    // Supabase doesn't have a native "not in" — use filter
    for (const excludeId of excludeBlockIds) {
      dbQuery = dbQuery.neq("id", excludeId);
    }
  }

  // Fetch a generous candidate pool (we'll re-rank and trim)
  dbQuery = dbQuery.limit(maxBlocks * 5);

  const { data: candidates, error } = await dbQuery;

  if (error) {
    console.error("[activity-blocks] Retrieval query failed:", error);
    return [];
  }

  if (!candidates || candidates.length === 0) return [];

  // ─── Hybrid scoring ───

  // Compute max values for normalization
  const maxTimesUsed = Math.max(1, ...candidates.map((b: ActivityBlock) => b.times_used || 0));
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scored = candidates.map((block: any) => {
    // 1. Vector similarity (0-1) — cosine between query embedding and block embedding
    let vectorScore = 0;
    if (queryEmbedding && block.embedding) {
      try {
        const blockVec = typeof block.embedding === "string"
          ? JSON.parse(block.embedding)
          : block.embedding;
        vectorScore = cosineSimilarity(queryEmbedding, blockVec);
      } catch {
        // Skip malformed embeddings
      }
    }

    // 2. Efficacy normalized (0-1)
    const efficacyScore = (block.efficacy_score || 50) / 100;

    // 3. Text match (0-1) — what fraction of query terms appear in title+prompt+description
    const blockText = `${block.title} ${block.prompt} ${block.description || ""}`.toLowerCase();
    const matchCount = queryTerms.filter(t => blockText.includes(t)).length;
    const textScore = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;

    // 4. Usage signal (0-1) — normalized by max usage in candidate set
    const usageScore = (block.times_used || 0) / maxTimesUsed;

    // Weighted composite
    const relevanceScore =
      0.50 * vectorScore +
      0.20 * efficacyScore +
      0.15 * textScore +
      0.15 * usageScore;

    return {
      ...block,
      relevance_score: Math.round(relevanceScore * 1000) / 1000,
    };
  });

  // Sort by relevance, take top N
  scored.sort((a: { relevance_score: number }, b: { relevance_score: number }) =>
    b.relevance_score - a.relevance_score
  );

  return scored.slice(0, maxBlocks);
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Format retrieved blocks for injection into a generation prompt.
 */
export function formatBlocksForPrompt(
  blocks: import("./types").RetrievedBlock[]
): import("./types").FormattedBlockForPrompt[] {
  return blocks.map((b) => ({
    id: b.id,
    title: b.title,
    prompt: b.prompt,
    efficacy_score: b.efficacy_score || 50,
    times_used: b.times_used || 0,
    bloom_level: b.bloom_level,
    grouping: b.grouping,
    time_weight: b.time_weight,
    design_phase: b.design_phase,
    success_look_fors: b.success_look_fors,
    ai_rules: b.ai_rules,
    response_type: b.response_type,
    materials_needed: b.materials_needed,
  }));
}

/**
 * Format retrieved blocks as a text block for injection into generation prompts.
 * Returns a human-readable section that the AI model can use as reference.
 */
export function formatBlocksAsPromptText(
  blocks: import("./types").RetrievedBlock[]
): string {
  if (blocks.length === 0) return "";

  const formatted = formatBlocksForPrompt(blocks);
  const lines = formatted.map((b, i) => {
    const meta: string[] = [];
    if (b.bloom_level) meta.push(`bloom=${b.bloom_level}`);
    if (b.grouping) meta.push(`grouping=${b.grouping}`);
    if (b.time_weight) meta.push(`time=${b.time_weight}`);
    if (b.design_phase) meta.push(`phase=${b.design_phase}`);
    if (b.response_type) meta.push(`response=${b.response_type}`);
    if (b.efficacy_score > 50) meta.push(`efficacy=${b.efficacy_score}`);
    if (b.times_used > 0) meta.push(`used=${b.times_used}x`);

    let entry = `${i + 1}. **${b.title}** [${meta.join(", ")}]\n   ${b.prompt}`;
    if (b.success_look_fors?.length) {
      entry += `\n   Look-fors: ${b.success_look_fors.join("; ")}`;
    }
    if (b.materials_needed?.length) {
      entry += `\n   Materials: ${b.materials_needed.join(", ")}`;
    }
    return entry;
  });

  return `## Proven Activity Blocks (from teacher's library)
These are tested, reusable activities with known efficacy. When a block matches the lesson needs, ADAPT it rather than generating from scratch — set source_block_id to the block's ID. Each block has metadata (bloom level, grouping, timeWeight, look-fors) that should be preserved or refined when adapting.

${lines.join("\n\n")}`;
}

/**
 * Increment times_used counter when a block is used in generation.
 */
export async function recordBlockUsage(
  supabase: SupabaseClient,
  blockId: string
): Promise<void> {
  const { error } = await supabase.rpc("increment_block_usage", { block_id: blockId });
  if (error) {
    // Fallback: read-then-write if RPC not available
    const { data } = await supabase
      .from("activity_blocks")
      .select("times_used")
      .eq("id", blockId)
      .maybeSingle();
    if (data) {
      await supabase
        .from("activity_blocks")
        .update({ times_used: (data.times_used || 0) + 1 })
        .eq("id", blockId);
    }
  }
}

/**
 * Scan generated pages for source_block_id references and record usage.
 * Fire-and-forget — errors are logged but never block generation.
 */
export async function recordBlockUsageFromPages(
  supabase: SupabaseClient,
  pages: Array<{ sections?: Array<{ source_block_id?: string | null }> }>
): Promise<number> {
  const blockIds = new Set<string>();
  for (const page of pages) {
    if (!page.sections) continue;
    for (const section of page.sections) {
      if (section.source_block_id) blockIds.add(section.source_block_id);
    }
  }

  if (blockIds.size === 0) return 0;

  // Fire all usage increments in parallel
  await Promise.allSettled(
    Array.from(blockIds).map((id) => recordBlockUsage(supabase, id))
  );

  return blockIds.size;
}

/**
 * Compute SHA-256 hash for file deduplication.
 */
export async function computeFileHash(fileBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Check if a file with this hash already exists for the teacher.
 * Returns the existing upload ID if duplicate, null if new.
 */
export async function checkFileHash(
  supabase: SupabaseClient,
  teacherId: string,
  fileHash: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("knowledge_uploads")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}
