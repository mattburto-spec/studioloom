/**
 * Retrieval layer for RAG-enhanced unit generation.
 * Performs hybrid search (vector + BM25) with quality-weighted reranking.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { embedText } from "../ai/embeddings";

export interface RetrievedChunk {
  id: string;
  content: string;
  context_preamble: string | null;
  metadata: {
    source_type: string;
    source_filename: string | null;
    criterion: string | null;
    page_id: string | null;
    grade_level: string | null;
    subject_area: string | null;
    topic: string | null;
    global_context: string | null;
    content_type: string | null;
    fork_count: number;
    teacher_rating: number | null;
  };
  similarity: number;
  quality_score: number;
  final_score: number;
}

export interface RetrievalParams {
  /** Natural language query describing what to retrieve */
  query: string;
  /** Filter by criterion (A, B, C, D) */
  criterion?: string;
  /** Filter by grade level */
  gradeLevel?: string;
  /** Prioritise this teacher's content */
  teacherId?: string;
  /** Also include public community content */
  includePublic?: boolean;
  /** Max chunks to return */
  maxChunks?: number;
  /** Weight for semantic similarity vs quality (0-1) */
  similarityWeight?: number;
}

/**
 * Retrieve relevant knowledge chunks for unit generation.
 * Teacher's own content is prioritised, then community content fills remaining slots.
 */
export async function retrieveContext(
  params: RetrievalParams
): Promise<RetrievedChunk[]> {
  const {
    query,
    criterion,
    gradeLevel,
    teacherId,
    includePublic = true,
    maxChunks = 10,
    similarityWeight = 0.7,
  } = params;

  // Generate query embedding
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch (err) {
    console.warn("[retrieve] Embedding failed, returning empty:", err);
    return [];
  }

  // Call the hybrid search RPC
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc("match_knowledge_chunks", {
    query_embedding: `[${queryEmbedding.join(",")}]`,
    query_text: query,
    match_count: maxChunks,
    similarity_weight: similarityWeight,
    quality_weight: 1 - similarityWeight,
    filter_criterion: criterion || null,
    filter_grade: gradeLevel || null,
    filter_teacher_id: teacherId || null,
    include_public: includePublic,
  });

  if (error) {
    console.error("[retrieve] Search failed:", error);
    return [];
  }

  return (data || []) as RetrievedChunk[];
}

/**
 * Build a formatted context string from retrieved chunks for injection into prompts.
 */
export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const examples = chunks.map((chunk, i) => {
    const source = chunk.metadata.source_filename
      ? `from "${chunk.metadata.source_filename}"`
      : chunk.metadata.topic
        ? `from unit on "${chunk.metadata.topic}"`
        : "from knowledge base";

    const criterion = chunk.metadata.criterion
      ? ` — Criterion ${chunk.metadata.criterion}`
      : "";
    const grade = chunk.metadata.grade_level
      ? `, ${chunk.metadata.grade_level}`
      : "";

    return `### Example ${i + 1} (${source}${criterion}${grade})\n${chunk.context_preamble ? chunk.context_preamble + "\n\n" : ""}${chunk.content}`;
  });

  return `## Reference Examples from Similar Units
The following are excerpts from high-quality existing units on similar topics.
Use these as inspiration for structure, activity design, and scaffolding —
but create original content tailored to this specific unit.

${examples.join("\n\n")}`;
}

/**
 * Record that chunks were retrieved (for quality signal tracking).
 */
export async function recordRetrieval(chunkIds: string[]): Promise<void> {
  if (chunkIds.length === 0) return;

  // Increment times_retrieved for each chunk
  const supabaseAdmin = createAdminClient();
  for (const id of chunkIds) {
    try {
      await supabaseAdmin.rpc("increment_chunk_retrieval", { chunk_id: id });
    } catch {
      // Non-critical — don't fail generation if tracking fails
    }
  }
}
