/**
 * Stage I-0: Dedup Check
 *
 * Two layers:
 *   1. Hard dedup — SHA-256 file_hash vs content_items.file_hash. Match → skip
 *      all downstream stages, link to existing content_item.
 *   2. Soft dedup — Voyage embedding of normalised raw text vs all existing
 *      activity_blocks embeddings (in-memory cosine, 0.92 threshold). Surfaces
 *      a near-duplicate signal in the sandbox so the curator sees it before
 *      committing. Does NOT skip downstream stages.
 *
 * The split is deliberate: file_hash catches identical re-uploads; cosine
 * catches "same lesson, different .docx export" or "rephrased copy". Cosine
 * is informational because the new upload may legitimately be an iteration
 * the curator wants to keep.
 */

import { createHash } from "crypto";
import type { CostBreakdown } from "@/types/activity-blocks";
import type { DedupResult, PassConfig } from "./types";
import { embedText } from "@/lib/ai/embeddings";

const ZERO_COST: CostBreakdown = {
  inputTokens: 0,
  outputTokens: 0,
  modelId: "none",
  estimatedCostUSD: 0,
  timeMs: 0,
};

/** Cosine similarity threshold above which we surface a near-duplicate. */
export const COSINE_NEAR_DUPLICATE_THRESHOLD = 0.92;

/** Maximum chars of raw text fed to the embedder for soft dedup. */
const SOFT_DEDUP_TEXT_BUDGET = 4000;

/** Compute SHA-256 hash of raw content (string or Buffer). */
export function computeHash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Parse a halfvec/pgvector literal ("[0.1,0.2,...]") into a number array.
 * Returns null for malformed input — caller skips such rows.
 */
function parsePgVector(v: unknown): number[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v as number[];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  try {
    const arr = trimmed.slice(1, -1).split(",").map((s) => parseFloat(s));
    if (arr.some((n) => !Number.isFinite(n))) return null;
    return arr;
  } catch {
    return null;
  }
}

/**
 * Normalise text for embedding: collapse whitespace, drop very short docs.
 * Voyage handles its own tokenisation; we just trim the budget.
 */
function normaliseForEmbedding(rawText: string): string {
  return rawText.replace(/\s+/g, " ").trim().slice(0, SOFT_DEDUP_TEXT_BUDGET);
}

/**
 * Soft dedup: embed the document and find the nearest existing block.
 * Failure-tolerant — any error returns no signal rather than blocking the
 * pipeline (the curator can still proceed; soft dedup is advisory).
 */
async function findNearDuplicate(
  rawText: string,
  config: PassConfig
): Promise<{
  blockId: string;
  blockTitle: string;
  score: number;
} | null> {
  if (!config.supabaseClient) return null;

  const normalised = normaliseForEmbedding(rawText);
  if (normalised.length < 100) return null;

  let docVec: number[];
  try {
    docVec = await embedText(normalised);
  } catch {
    return null;
  }

  let rows: Array<{ id: string; title: string; embedding: unknown }>;
  try {
    const { data, error } = await config.supabaseClient
      .from("activity_blocks")
      .select("id, title, embedding")
      .not("embedding", "is", null)
      .limit(2000);
    if (error || !data) return null;
    rows = data as Array<{ id: string; title: string; embedding: unknown }>;
  } catch {
    return null;
  }

  let best: { blockId: string; blockTitle: string; score: number } | null = null;
  for (const row of rows) {
    const vec = parsePgVector(row.embedding);
    if (!vec || vec.length !== docVec.length) continue;
    const score = cosineSimilarity(docVec, vec);
    if (best === null || score > best.score) {
      best = { blockId: row.id, blockTitle: row.title, score };
    }
  }

  if (best && best.score >= COSINE_NEAR_DUPLICATE_THRESHOLD) {
    return best;
  }
  return null;
}

/** Check if this content has already been ingested. */
export async function dedupCheck(
  content: string | Buffer,
  config: PassConfig
): Promise<DedupResult> {
  const startTime = Date.now();
  const fileHash = computeHash(content);

  if (!config.supabaseClient) {
    return { fileHash, isDuplicate: false, cost: { ...ZERO_COST, timeMs: Date.now() - startTime } };
  }

  // Layer 1: hard dedup via file_hash
  try {
    const query = config.supabaseClient
      .from("content_items")
      .select("id")
      .eq("file_hash", fileHash);
    const filtered = config.teacherId
      ? query.eq("teacher_id", config.teacherId)
      : query;
    const { data } = await filtered.limit(1);

    if (data && data.length > 0) {
      return {
        fileHash,
        isDuplicate: true,
        existingContentItemId: data[0].id,
        cost: { ...ZERO_COST, timeMs: Date.now() - startTime },
      };
    }
  } catch {
    // Table may not exist yet — fall through to soft dedup
  }

  // Layer 2: soft dedup via embedding cosine similarity
  // Only for string content; binary buffers (raw PDFs) skip this.
  let nearDup: Awaited<ReturnType<typeof findNearDuplicate>> = null;
  if (typeof content === "string") {
    nearDup = await findNearDuplicate(content, config);
  }

  return {
    fileHash,
    isDuplicate: false,
    nearDuplicateScore: nearDup?.score,
    nearDuplicateBlockId: nearDup?.blockId,
    nearDuplicateBlockTitle: nearDup?.blockTitle,
    cost: { ...ZERO_COST, timeMs: Date.now() - startTime },
  };
}
