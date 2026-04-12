import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Monthly Library Hygiene Job
 * - Creates merge proposals for high-similarity, low-efficacy duplicate pairs
 * - Archives orphaned blocks (unused for 12 months, low efficacy)
 */

export interface MonthlyHygieneSummary {
  merge_proposals: number;
  archived: number;
}

export async function runMonthlyHygiene(
  supabase: SupabaseClient
): Promise<{ alertId: string; summary: MonthlyHygieneSummary }> {
  const summary: MonthlyHygieneSummary = {
    merge_proposals: 0,
    archived: 0,
  };

  // ====== 1. Consolidation Pass ======
  // Find high-similarity duplicates (0.95-1.0) where BOTH blocks have efficacy < 60
  const { data: highSimilarityPairs, error: similarityError } = await supabase.rpc(
    "find_duplicate_blocks",
    {
      min_similarity: 0.95,
      max_similarity: 1.0,
      max_results: 50,
    }
  );

  if (similarityError) {
    throw new Error(
      `Failed to find high-similarity duplicates: ${similarityError.message}`
    );
  }

  for (const pair of (highSimilarityPairs as Array<{
    block_a_id: string;
    block_b_id: string;
    similarity: number;
    title_a: string;
    title_b: string;
  }>) ?? []) {
    const { blockAId, blockBId, similarity, titleA, titleB } = {
      blockAId: pair.block_a_id,
      blockBId: pair.block_b_id,
      similarity: pair.similarity,
      titleA: pair.title_a,
      titleB: pair.title_b,
    };

    // Fetch both blocks to check efficacy
    const { data: blockA } = await supabase
      .from("activity_blocks")
      .select("efficacy_score, id, title")
      .eq("id", blockAId)
      .single();

    const { data: blockB } = await supabase
      .from("activity_blocks")
      .select("efficacy_score, id, title")
      .eq("id", blockBId)
      .single();

    const efficacyA = (blockA?.efficacy_score as number) ?? 50;
    const efficacyB = (blockB?.efficacy_score as number) ?? 50;

    // Only proceed if BOTH are below efficacy 60
    if (efficacyA >= 60 || efficacyB >= 60) {
      continue;
    }

    // Determine which is the "lower efficacy" block (candidate to merge into the other)
    const [sourceId, targetId] =
      efficacyA < efficacyB ? [blockAId, blockBId] : [blockBId, blockAId];

    // Check if merge proposal already exists
    const { data: existingProposals } = await supabase
      .from("feedback_proposals")
      .select("id")
      .eq("block_id", sourceId)
      .eq("proposal_type", "merge")
      .eq("status", "pending")
      .limit(1);

    if ((existingProposals?.length ?? 0) > 0) {
      continue;
    }

    // Create merge proposal
    const { error: proposalError } = await supabase
      .from("feedback_proposals")
      .insert({
        block_id: sourceId,
        proposal_type: "merge",
        status: "pending",
        field: "merge_candidate",
        current_value: {
          id: sourceId,
          title: sourceId === blockAId ? titleA : titleB,
          efficacy: sourceId === blockAId ? efficacyA : efficacyB,
        },
        proposed_value: {
          id: targetId,
          title: targetId === blockAId ? titleA : titleB,
          efficacy: targetId === blockAId ? efficacyA : efficacyB,
        },
        evidence_summary: `Cosine similarity ${similarity.toFixed(4)}, both below efficacy 60`,
        requires_manual_approval: true,
      });

    if (proposalError) {
      console.error(`Failed to create merge proposal for ${sourceId}:`, proposalError);
    } else {
      summary.merge_proposals++;
    }
  }

  // ====== 2. Orphan Archival ======
  // Find blocks where:
  // - last_used_at < now() - 12 months (or null + created_at < 12 months ago)
  // - efficacy_score < 30
  // - is_archived IS NOT TRUE
  const twelveMonthsAgo = new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: orphanBlocks, error: orphanError } = await supabase
    .from("activity_blocks")
    .select("id")
    .or(
      `last_used_at.lt.${twelveMonthsAgo},and(last_used_at.is.null,created_at.lt.${twelveMonthsAgo})`
    )
    .lt("efficacy_score", 30)
    .eq("is_archived", false);

  if (orphanError) {
    throw new Error(`Failed to fetch orphan blocks: ${orphanError.message}`);
  }

  // Archive each orphan block
  for (const block of orphanBlocks ?? []) {
    const blockId = block.id as string;

    const { error: archiveError } = await supabase
      .from("activity_blocks")
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq("id", blockId);

    if (archiveError) {
      console.error(`Failed to archive block ${blockId}:`, archiveError);
    } else {
      summary.archived++;
    }
  }

  // ====== 3. Write Health Summary to system_alerts ======
  const { data: alertData, error: alertError } = await supabase
    .from("system_alerts")
    .insert({
      alert_type: "monthly_hygiene",
      severity: "info",
      payload: summary,
    })
    .select("id");

  if (alertError) {
    throw new Error(`Failed to insert monthly hygiene alert: ${alertError.message}`);
  }

  const alertId = (alertData?.[0]?.id as string) ?? "";

  return {
    alertId,
    summary,
  };
}
