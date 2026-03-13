/**
 * Auto-ingest a created/edited unit into the knowledge base.
 * Called after a teacher saves a unit — chunks each page and embeds.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { chunkUnitPage, type ChunkMetadata } from "./chunk";
import { embedAll } from "../ai/embeddings";
import type { PageContent } from "@/types";

/**
 * Ingest a unit's content into the knowledge base.
 * Replaces any existing chunks for this unit.
 */
export async function ingestUnit(
  unitId: string,
  unitData: {
    title: string;
    topic?: string;
    description?: string;
    grade_level?: string;
    global_context?: string;
    key_concept?: string;
    pages: Record<string, PageContent>;
  },
  teacherId: string,
  isPublic: boolean = false
): Promise<{ chunkCount: number }> {
  // 1. Delete existing chunks for this unit
  const supabaseAdmin = createAdminClient();

  await supabaseAdmin
    .from("knowledge_chunks")
    .delete()
    .eq("source_type", "created_unit")
    .eq("source_id", unitId);

  // 2. Build metadata shared across all chunks
  const metadata: ChunkMetadata = {
    source_type: "created_unit",
    source_id: unitId,
    teacher_id: teacherId,
    grade_level: unitData.grade_level,
    topic: unitData.topic || unitData.title,
    global_context: unitData.global_context,
    key_concept: unitData.key_concept,
    is_public: isPublic,
  };

  // 3. Create overview chunk
  const overviewText = [
    `Unit: ${unitData.title}`,
    unitData.topic ? `Topic: ${unitData.topic}` : null,
    unitData.description ? `Description: ${unitData.description}` : null,
    unitData.global_context
      ? `Global Context: ${unitData.global_context}`
      : null,
    unitData.key_concept ? `Key Concept: ${unitData.key_concept}` : null,
    `Pages: ${Object.keys(unitData.pages).sort().join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  // 4. Create page-level chunks
  const pageChunks = Object.entries(unitData.pages).map(([pageId, page]) =>
    chunkUnitPage(pageId, page, metadata)
  );

  // 5. Combine all chunks
  const allChunks = [
    {
      content: overviewText,
      content_type: "overview" as const,
      criterion: undefined as string | undefined,
      page_id: undefined as string | undefined,
      metadata,
    },
    ...pageChunks,
  ];

  // 6. Generate embeddings for all chunks
  const texts = allChunks.map((c) => c.content);
  let embeddings: number[][];
  try {
    embeddings = await embedAll(texts);
  } catch (err) {
    console.warn(
      "[ingest-unit] Embedding failed, storing chunks without embeddings:",
      err
    );
    embeddings = texts.map(() => []);
  }

  // 7. Insert into knowledge_chunks
  const rows = allChunks.map((chunk, i) => ({
    source_type: chunk.metadata.source_type,
    source_id: chunk.metadata.source_id,
    teacher_id: chunk.metadata.teacher_id,
    content: chunk.content,
    criterion: chunk.criterion,
    page_id: chunk.page_id,
    grade_level: chunk.metadata.grade_level,
    topic: chunk.metadata.topic,
    global_context: chunk.metadata.global_context,
    key_concept: chunk.metadata.key_concept,
    content_type: chunk.content_type,
    is_public: chunk.metadata.is_public,
    embedding: embeddings[i]?.length ? `[${embeddings[i].join(",")}]` : null,
  }));

  const { error } = await supabaseAdmin
    .from("knowledge_chunks")
    .insert(rows);

  if (error) {
    console.error("[ingest-unit] Insert failed:", error);
    throw new Error(`Failed to ingest unit: ${error.message}`);
  }

  return { chunkCount: rows.length };
}
