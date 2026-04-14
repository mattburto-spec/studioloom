/**
 * Persist moderated blocks from the ingestion pipeline to the activity_blocks
 * table so they appear in the teacher review queue.
 *
 * Fire-and-forget: never throws. Partial success is OK — each batch is
 * independent. Mirrors the embedding + batch-of-50 pattern from
 * src/lib/activity-blocks/store.ts but maps the ModeratedBlock shape
 * (which includes moderation_status, moderation_flags, pii_flags, phase,
 * activity_category, copyright_flag) that the existing helper doesn't support.
 */

import type { ModeratedBlock } from "./types";

const BATCH_SIZE = 50;

export async function persistModeratedBlocks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural shape; matches PassConfig pattern in types.ts
  adminClient: { from: (table: string) => any },
  teacherId: string,
  contentItemId: string | null,
  blocks: ModeratedBlock[]
): Promise<{ insertedCount: number; errors: string[] }> {
  if (blocks.length === 0) {
    return { insertedCount: 0, errors: [] };
  }

  // Generate embeddings — proceed with null on failure
  const textsToEmbed = blocks.map(
    (b) => `${b.title}. ${b.description || ""} ${b.prompt}`.trim()
  );

  let embeddings: number[][] | null = null;
  try {
    const { embedAll } = await import("@/lib/ai/embeddings");
    embeddings = await embedAll(textsToEmbed);
  } catch (err) {
    console.warn("[persist-blocks] Embedding generation failed, inserting without vectors:", err);
  }

  // Map ModeratedBlock[] → activity_blocks rows
  const rows = blocks.map((b, i) => ({
    teacher_id: teacherId,
    title: b.title,
    description: b.description || null,
    prompt: b.prompt,
    source_type: "extracted" as const,
    source_upload_id: contentItemId || null,
    bloom_level: b.bloom_level || null,
    time_weight: b.time_weight || "moderate",
    grouping: b.grouping || "individual",
    phase: b.phase || null,
    activity_category: b.activity_category || null,
    materials_needed: b.materials.length > 0 ? b.materials : null,
    pii_scanned: true,
    pii_flags: b.piiFlags.length > 0 ? b.piiFlags : null,
    copyright_flag: b.copyrightFlag,
    moderation_status: b.moderationStatus,
    teacher_verified: false,
    is_public: false,
    is_archived: false,
    embedding: embeddings?.[i] ? JSON.stringify(embeddings[i]) : null,
  }));

  // Insert in batches of 50
  let insertedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const { data, error } = await adminClient
        .from("activity_blocks")
        .insert(batch)
        .select("id");

      if (error) {
        console.error("[persist-blocks] Insert batch failed:", error);
        errors.push(error.message || String(error));
        continue;
      }

      if (data) {
        insertedCount += data.length;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[persist-blocks] Insert batch threw:", msg);
      errors.push(msg);
    }
  }

  return { insertedCount, errors };
}
