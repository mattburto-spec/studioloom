import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Weekly Library Hygiene Job
 * - Applies staleness decay to unused blocks
 * - Flags duplicate suspects via cosine similarity
 * - Flags low-efficacy blocks
 * - Marks blocks with stale embeddings for re-generation
 */

export interface WeeklyHygieneSummary {
  decayed: number;
  flagged_duplicates: number;
  flagged_low_efficacy: number;
  stale_embeddings: number;
}

export async function runWeeklyHygiene(
  supabase: SupabaseClient
): Promise<{ alertId: string; summary: WeeklyHygieneSummary }> {
  const summary: WeeklyHygieneSummary = {
    decayed: 0,
    flagged_duplicates: 0,
    flagged_low_efficacy: 0,
    stale_embeddings: 0,
  };

  // ====== 1. Staleness Decay ======
  // Find blocks where last_used_at < now() - 6 months
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  // Get blocks eligible for decay
  const { data: stalenessTargets, error: stalenessError } = await supabase
    .from("activity_blocks")
    .select("id, efficacy_score, decay_applied_total")
    .or(
      `last_used_at.lt.${sixMonthsAgo},and(last_used_at.is.null,created_at.lt.${sixMonthsAgo})`
    )
    .eq("is_archived", false);

  if (stalenessError) {
    throw new Error(`Failed to fetch staleness targets: ${stalenessError.message}`);
  }

  // Apply decay in batch: decrement efficacy_score by 1, increment decay_applied_total by 1
  // but ONLY if decay_applied_total < 6
  for (const block of stalenessTargets ?? []) {
    const blockId = block.id as string;
    const currentDecay = (block.decay_applied_total as number) ?? 0;

    if (currentDecay < 6) {
      const { error: updateError } = await supabase
        .from("activity_blocks")
        .update({
          efficacy_score: ((block.efficacy_score as number) ?? 50) - 1,
          decay_applied_total: currentDecay + 1,
        })
        .eq("id", blockId);

      if (updateError) {
        console.error(`Failed to apply decay to block ${blockId}:`, updateError);
      } else {
        summary.decayed++;
      }
    }
  }

  // ====== 2. Flag Duplicate Suspects ======
  // Call RPC with min_similarity=0.88, max_similarity=0.92
  const { data: duplicatePairs, error: duplicateError } = await supabase.rpc(
    "find_duplicate_blocks",
    {
      min_similarity: 0.88,
      max_similarity: 0.92,
      max_results: 50,
    }
  );

  if (duplicateError) {
    throw new Error(`Failed to find duplicate blocks: ${duplicateError.message}`);
  }

  // For each pair, check if unresolved flag already exists on either block
  for (const pair of (duplicatePairs as Array<{
    block_a_id: string;
    block_b_id: string;
    similarity: number;
  }>) ?? []) {
    const { blockAId, blockBId, similarity } = {
      blockAId: pair.block_a_id,
      blockBId: pair.block_b_id,
      similarity: pair.similarity,
    };

    // Check for existing unresolved flag on either block
    const { data: existingFlagsA } = await supabase
      .from("library_health_flags")
      .select("id")
      .eq("block_id", blockAId)
      .eq("flag_type", "duplicate_suspect")
      .is("resolved_at", null)
      .limit(1);

    const { data: existingFlagsB } = await supabase
      .from("library_health_flags")
      .select("id")
      .eq("block_id", blockBId)
      .eq("flag_type", "duplicate_suspect")
      .is("resolved_at", null)
      .limit(1);

    // Skip if either block already has unresolved flag
    if ((existingFlagsA?.length ?? 0) > 0 || (existingFlagsB?.length ?? 0) > 0) {
      continue;
    }

    // Insert flag for block_a
    const { error: flagError } = await supabase
      .from("library_health_flags")
      .insert({
        block_id: blockAId,
        flag_type: "duplicate_suspect",
        severity: "amber",
        reason: `Cosine similarity: ${similarity.toFixed(4)} with block ${blockBId}`,
      });

    if (flagError) {
      console.error(`Failed to insert duplicate flag for ${blockAId}:`, flagError);
    } else {
      summary.flagged_duplicates++;
    }
  }

  // ====== 3. Flag Low-Efficacy Blocks ======
  // Find blocks with efficacy_score < 40, times_used >= 3, not archived
  const { data: lowEfficacyBlocks, error: lowEfficacyError } = await supabase
    .from("activity_blocks")
    .select("id")
    .lt("efficacy_score", 40)
    .gte("times_used", 3)
    .eq("is_archived", false);

  if (lowEfficacyError) {
    throw new Error(`Failed to fetch low-efficacy blocks: ${lowEfficacyError.message}`);
  }

  for (const block of lowEfficacyBlocks ?? []) {
    const blockId = block.id as string;

    // Check if unresolved low_efficacy flag already exists
    const { data: existingFlags } = await supabase
      .from("library_health_flags")
      .select("id")
      .eq("block_id", blockId)
      .eq("flag_type", "low_efficacy")
      .is("resolved_at", null)
      .limit(1);

    if ((existingFlags?.length ?? 0) > 0) {
      continue;
    }

    // Get current efficacy and times_used for reason
    const { data: blockData } = await supabase
      .from("activity_blocks")
      .select("efficacy_score, times_used")
      .eq("id", blockId)
      .single();

    const score = (blockData?.efficacy_score as number) ?? 40;
    const uses = (blockData?.times_used as number) ?? 3;

    const { error: flagError } = await supabase
      .from("library_health_flags")
      .insert({
        block_id: blockId,
        flag_type: "low_efficacy",
        severity: "red",
        reason: `Efficacy ${score.toFixed(1)} after ${uses} uses`,
      });

    if (flagError) {
      console.error(`Failed to insert low_efficacy flag for ${blockId}:`, flagError);
    } else {
      summary.flagged_low_efficacy++;
    }
  }

  // ====== 4. Flag Stale Embeddings ======
  // Find blocks where title/description changed since embedding_generated_at
  // (i.e., updated_at > embedding_generated_at)
  const { data: staleEmbeddingBlocks, error: staleEmbeddingError } = await supabase
    .from("activity_blocks")
    .select("id")
    .gt("updated_at", "embedding_generated_at")
    .not("embedding_generated_at", "is", null);

  if (staleEmbeddingError) {
    throw new Error(`Failed to fetch stale embedding blocks: ${staleEmbeddingError.message}`);
  }

  for (const block of staleEmbeddingBlocks ?? []) {
    const blockId = block.id as string;

    // Check if stale_embedding flag already exists
    const { data: existingFlags } = await supabase
      .from("library_health_flags")
      .select("id")
      .eq("block_id", blockId)
      .eq("flag_type", "stale_embedding")
      .is("resolved_at", null)
      .limit(1);

    if ((existingFlags?.length ?? 0) > 0) {
      continue;
    }

    const { error: flagError } = await supabase
      .from("library_health_flags")
      .insert({
        block_id: blockId,
        flag_type: "stale_embedding",
        severity: "amber",
        reason: "Content updated since embedding generation",
      });

    if (flagError) {
      console.error(`Failed to insert stale_embedding flag for ${blockId}:`, flagError);
    } else {
      summary.stale_embeddings++;
    }
  }

  // ====== 5. Write Summary to system_alerts ======
  const { data: alertData, error: alertError } = await supabase
    .from("system_alerts")
    .insert({
      alert_type: "weekly_hygiene",
      severity: "info",
      payload: summary,
    })
    .select("id");

  if (alertError) {
    throw new Error(`Failed to insert weekly hygiene alert: ${alertError.message}`);
  }

  const alertId = (alertData?.[0]?.id as string) ?? "";

  return {
    alertId,
    summary,
  };
}
