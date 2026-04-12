import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Type Definitions ───────────────────────────────────────────────────

export interface SourceTypeCount {
  source_type: string;
  count: number;
}

export interface CategoryCount {
  activity_category: string;
  count: number;
}

export interface StaleBlock {
  id: string;
  title: string;
  last_used_at: string | null;
  times_used: number;
}

export interface DuplicateSuspect {
  block_a_id: string;
  block_b_id: string;
  similarity: number;
  title_a: string;
  title_b: string;
}

export interface LowEfficacyBlock {
  id: string;
  title: string;
  efficacy_score: number;
  times_used: number;
}

export interface OrphanBlock {
  id: string;
  title: string;
  missing_fields: string[];
}

export interface EmbeddingHealth {
  total: number;
  missing_embedding: number;
  healthy: number;
}

export interface CoverageCell {
  phase: string;
  activity_category: string;
  count: number;
}

// ─── Query Functions ────────────────────────────────────────────────────

/**
 * Get block distribution by source type.
 * Aggregates counts in JavaScript since Supabase REST doesn't support GROUP BY directly.
 */
export async function getBlocksBySourceType(
  supabase: SupabaseClient
): Promise<SourceTypeCount[]> {
  const { data, error } = await supabase
    .from("activity_blocks")
    .select("source_type")
    .not("is_archived", "is", true);

  if (error) {
    throw new Error(`Failed to fetch blocks by source type: ${error.message}`);
  }

  // Aggregate in JavaScript
  const counts = new Map<string, number>();
  for (const block of data ?? []) {
    const sourceType = block.source_type || "unknown";
    counts.set(sourceType, (counts.get(sourceType) ?? 0) + 1);
  }

  // Convert to sorted array
  return Array.from(counts.entries())
    .map(([source_type, count]) => ({ source_type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get block distribution by activity category.
 * Aggregates counts in JavaScript.
 */
export async function getCategoryDistribution(
  supabase: SupabaseClient
): Promise<CategoryCount[]> {
  const { data, error } = await supabase
    .from("activity_blocks")
    .select("activity_category")
    .not("is_archived", "is", true);

  if (error) {
    throw new Error(
      `Failed to fetch category distribution: ${error.message}`
    );
  }

  // Aggregate in JavaScript
  const counts = new Map<string, number>();
  for (const block of data ?? []) {
    const category = block.activity_category || "unknown";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  // Convert to sorted array
  return Array.from(counts.entries())
    .map(([activity_category, count]) => ({ activity_category, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get blocks that haven't been used recently.
 * Blocks with last_used_at older than the threshold, plus blocks with null last_used_at
 * that were created more than `days` ago.
 */
export async function getStaleBlocks(
  supabase: SupabaseClient,
  days: number = 90
): Promise<StaleBlock[]> {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);
  const thresholdISO = thresholdDate.toISOString();

  const { data, error } = await supabase
    .from("activity_blocks")
    .select("id, title, last_used_at, times_used")
    .eq("is_archived", false)
    .lt("last_used_at", thresholdISO)
    .order("last_used_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(`Failed to fetch stale blocks: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get blocks that are likely duplicates based on embedding similarity.
 * Uses the RPC function find_duplicate_blocks which returns pairs with similarity scores.
 */
export async function getDuplicateSuspects(
  supabase: SupabaseClient,
  minSim: number = 0.88,
  maxSim: number = 0.92
): Promise<DuplicateSuspect[]> {
  const { data, error } = await supabase.rpc("find_duplicate_blocks", {
    min_similarity: minSim,
    max_similarity: maxSim,
    max_results: 50,
  });

  if (error) {
    throw new Error(`Failed to fetch duplicate suspects: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get blocks with low efficacy scores and non-zero usage.
 * Efficacy below threshold and used at least minUsage times.
 */
export async function getLowEfficacyBlocks(
  supabase: SupabaseClient,
  threshold: number = 40,
  minUsage: number = 3
): Promise<LowEfficacyBlock[]> {
  const { data, error } = await supabase
    .from("activity_blocks")
    .select("id, title, efficacy_score, times_used")
    .lt("efficacy_score", threshold)
    .gte("times_used", minUsage)
    .eq("is_archived", false)
    .order("efficacy_score", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch low efficacy blocks: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get blocks with missing required fields (orphaned blocks).
 * Identifies blocks where activity_category, phase, or embedding is null.
 */
export async function getOrphanBlocks(
  supabase: SupabaseClient
): Promise<OrphanBlock[]> {
  const { data, error } = await supabase
    .from("activity_blocks")
    .select("id, title, activity_category, phase, embedding");

  if (error) {
    throw new Error(`Failed to fetch orphan blocks: ${error.message}`);
  }

  const orphans: OrphanBlock[] = [];

  for (const block of data ?? []) {
    const missingFields: string[] = [];

    if (!block.activity_category) {
      missingFields.push("activity_category");
    }
    if (!block.phase) {
      missingFields.push("phase");
    }
    if (!block.embedding) {
      missingFields.push("embedding");
    }

    // Only include if at least one field is missing
    if (missingFields.length > 0) {
      orphans.push({
        id: block.id,
        title: block.title,
        missing_fields: missingFields,
      });
    }
  }

  return orphans;
}

/**
 * Check embedding generation health.
 * Returns counts for total blocks, missing embeddings, and healthy blocks.
 */
export async function getEmbeddingHealth(
  supabase: SupabaseClient
): Promise<EmbeddingHealth> {
  // Fetch total non-archived blocks
  const { count: totalCount, error: totalError } = await supabase
    .from("activity_blocks")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false);

  if (totalError) {
    throw new Error(`Failed to fetch total block count: ${totalError.message}`);
  }

  const total = totalCount ?? 0;

  // Fetch count of blocks missing embedding
  const { count: missingCount, error: missingError } = await supabase
    .from("activity_blocks")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false)
    .is("embedding", null);

  if (missingError) {
    throw new Error(
      `Failed to fetch missing embedding count: ${missingError.message}`
    );
  }

  const missing = missingCount ?? 0;

  return {
    total,
    missing_embedding: missing,
    healthy: Math.max(0, total - missing),
  };
}

/**
 * Get coverage heatmap data (phase × category crosstab).
 * Aggregates non-archived blocks by phase and activity_category.
 */
export async function getCoverageHeatmap(
  supabase: SupabaseClient
): Promise<CoverageCell[]> {
  const { data, error } = await supabase
    .from("activity_blocks")
    .select("phase, activity_category")
    .eq("is_archived", false);

  if (error) {
    throw new Error(`Failed to fetch coverage heatmap data: ${error.message}`);
  }

  // Build phase × category crosstab in JavaScript
  const heatmap = new Map<string, number>();

  for (const block of data ?? []) {
    const phase = block.phase || "unassigned";
    const category = block.activity_category || "unassigned";
    const key = `${phase}|${category}`;

    heatmap.set(key, (heatmap.get(key) ?? 0) + 1);
  }

  // Convert to array
  const cells: CoverageCell[] = Array.from(heatmap.entries()).map(
    ([key, count]) => {
      const [phase, activity_category] = key.split("|");
      return { phase, activity_category, count };
    }
  );

  // Sort by phase, then category
  return cells.sort((a, b) => {
    const phaseCompare = a.phase.localeCompare(b.phase);
    if (phaseCompare !== 0) return phaseCompare;
    return a.activity_category.localeCompare(b.activity_category);
  });
}
