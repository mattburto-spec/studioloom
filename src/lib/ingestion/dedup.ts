/**
 * Stage I-0: Dedup Check
 *
 * SHA-256 hash of uploaded content, checked against content_items.file_hash.
 * If match found: skip all processing, link to existing assets.
 */

import { createHash } from "crypto";
import type { CostBreakdown } from "@/types/activity-blocks";
import type { DedupResult, PassConfig } from "./types";

const ZERO_COST: CostBreakdown = {
  inputTokens: 0,
  outputTokens: 0,
  modelId: "none",
  estimatedCostUSD: 0,
  timeMs: 0,
};

/** Compute SHA-256 hash of raw content (string or Buffer). */
export function computeHash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Check if this content has already been ingested. */
export async function dedupCheck(
  content: string | Buffer,
  config: PassConfig
): Promise<DedupResult> {
  const fileHash = computeHash(content);

  if (!config.supabaseClient || !config.teacherId) {
    return { fileHash, isDuplicate: false, cost: ZERO_COST };
  }

  try {
    const { data } = await config.supabaseClient
      .from("content_items")
      .select("id")
      .eq("file_hash", fileHash)
      .eq("teacher_id", config.teacherId)
      .limit(1);

    if (data && data.length > 0) {
      return {
        fileHash,
        isDuplicate: true,
        existingContentItemId: data[0].id,
        cost: ZERO_COST,
      };
    }
  } catch {
    // Table may not exist yet — treat as no duplicate
  }

  return { fileHash, isDuplicate: false, cost: ZERO_COST };
}
