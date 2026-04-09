/**
 * Stage 1: Block Retrieval
 *
 * Queries the activity_blocks table using embedding similarity + metadata scoring.
 * When the library is empty, returns an empty candidates list (Stage 2 marks everything as gaps).
 *
 * Scoring formula:
 *   score = 0.35 * vectorSimilarity
 *         + 0.20 * efficacyNormalized
 *         + 0.20 * metadataFit
 *         + 0.15 * textMatch
 *         + 0.10 * usageSignal
 */

import type {
  CostBreakdown,
  GenerationRequest,
  BlockRetrievalResult,
  RetrievedBlock,
  ActivityBlock,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";
import { embedText } from "@/lib/ai/embeddings";

// ─── Types ───

interface RetrievalConfig {
  supabase: { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };
  teacherId: string;
  maxCandidates?: number;
  minScore?: number;
  visibility?: "private" | "public" | "all";
}

// ─── Helpers ───

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "voyage-3.5",
  estimatedCostUSD: 0, timeMs: 0,
};

function computeUsageSignal(timesUsed: number, maxTimesUsed: number): number {
  if (maxTimesUsed <= 0) return 0;
  return Math.log(timesUsed + 1) / Math.log(maxTimesUsed + 1);
}

function computeMetadataFit(block: ActivityBlock, profile: FormatProfile, request: GenerationRequest): number {
  let score = 0;
  let checks = 0;

  // Phase match — does the block's phase align with the profile's phases?
  if (block.phase) {
    checks++;
    if (profile.blockRelevance.phaseIds.includes(block.phase)) score += 1;
  }

  // Category boost/suppress
  if (block.activity_category) {
    checks++;
    if (profile.blockRelevance.boost.includes(block.activity_category)) score += 1;
    if (profile.blockRelevance.suppress.includes(block.activity_category)) score -= 0.5;
  }

  // Bloom level — higher bloom for later lessons, but any bloom is OK
  if (block.bloom_level) {
    checks++;
    score += 0.5; // Base credit for having bloom tagged
  }

  // Grouping — variety is good, any grouping gets credit
  if (block.grouping) {
    checks++;
    score += 0.5;
  }

  // Grade level match via tags (basic keyword)
  if (request.gradeLevel && block.tags.length > 0) {
    const gradeNorm = request.gradeLevel.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (block.tags.some(t => t.toLowerCase().replace(/[^a-z0-9]/g, "").includes(gradeNorm))) {
      score += 0.5;
    }
  }

  return checks > 0 ? Math.max(0, Math.min(1, score / Math.max(checks, 1))) : 0.5;
}

function computeTextMatch(block: ActivityBlock, topic: string): number {
  const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (topicWords.length === 0) return 0;

  const blockText = `${block.title} ${block.description || ""} ${block.prompt} ${block.tags.join(" ")}`.toLowerCase();
  let matchCount = 0;
  for (const word of topicWords) {
    if (blockText.includes(word)) matchCount++;
  }

  return matchCount / topicWords.length;
}

// ─── Main ───

export async function stage1_retrieveBlocks(
  request: GenerationRequest,
  profile: FormatProfile,
  config: RetrievalConfig
): Promise<BlockRetrievalResult> {
  const startMs = Date.now();
  const maxCandidates = config.maxCandidates ?? 30;
  const minScore = config.minScore ?? 0.15;
  const visibility = config.visibility ?? "private";

  try {
    // 1. Build query text for embedding
    const queryText = [
      request.topic,
      request.unitType,
      request.gradeLevel,
      request.context?.realWorldContext,
      request.context?.studentContext,
      request.preferences?.emphasisAreas?.join(", "),
    ].filter(Boolean).join(". ");

    // 2. Generate embedding
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embedText(queryText);
    } catch {
      // Embedding service unavailable — fall back to text-only matching
      return buildTextOnlyResult(request, profile, config, startMs);
    }

    // 3. Query activity_blocks with vector similarity
    // First try RPC-based similarity search, fall back to manual if not available
    let blocks: ActivityBlock[] = [];
    let totalSearched = 0;

    try {
      // Query blocks matching the teacher + visibility filter
      let query = config.supabase
        .from("activity_blocks")
        .select("*")
        .eq("is_archived", false)
        .limit(maxCandidates * 3); // Fetch more to allow scoring/filtering

      if (visibility === "private") {
        query = query.eq("teacher_id", config.teacherId);
      } else if (visibility === "public") {
        query = query.eq("is_public", true);
      }
      // "all" = no visibility filter

      const { data, error } = await query;
      if (error) {
        console.error("[stage1] Block query error:", error.message);
        return emptyResult(request, startMs);
      }

      blocks = (data || []) as ActivityBlock[];
      totalSearched = blocks.length;
    } catch (e) {
      console.error("[stage1] Block query exception:", e);
      return emptyResult(request, startMs);
    }

    if (blocks.length === 0) {
      return emptyResult(request, startMs);
    }

    // 4. Score each block
    const maxTimesUsed = Math.max(1, ...blocks.map(b => b.times_used));

    // Compute vector similarity client-side (blocks don't have embeddings stored inline typically)
    // For now we use text matching as a proxy. When pgvector match_activity_blocks RPC exists, use it.
    const candidates: RetrievedBlock[] = blocks.map(block => {
      const textMatch = computeTextMatch(block, request.topic);
      const efficacyNormalized = block.efficacy_score / 100;
      const metadataFit = computeMetadataFit(block, profile, request);
      const usageSignal = computeUsageSignal(block.times_used, maxTimesUsed);

      // Use text match as proxy for vector similarity when we can't do server-side vector search
      const vectorSimilarity = textMatch * 0.7 + metadataFit * 0.3;

      const relevanceScore =
        0.35 * vectorSimilarity +
        0.20 * efficacyNormalized +
        0.20 * metadataFit +
        0.15 * textMatch +
        0.10 * usageSignal;

      return {
        block,
        relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
        scoreBreakdown: {
          vectorSimilarity,
          efficacyNormalized,
          textMatch,
          usageSignal,
          metadataFit,
        },
      };
    })
      .filter(c => c.relevanceScore >= minScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxCandidates);

    const embeddingCost: CostBreakdown = {
      inputTokens: Math.ceil(queryText.length / 4),
      outputTokens: 0,
      modelId: "voyage-3.5",
      estimatedCostUSD: 0.0001, // ~$0.0001 per embedding
      timeMs: Date.now() - startMs,
    };

    return {
      request,
      candidates,
      retrievalMetrics: {
        totalBlocksSearched: totalSearched,
        candidatesReturned: candidates.length,
        avgRelevanceScore: candidates.length > 0
          ? candidates.reduce((s, c) => s + c.relevanceScore, 0) / candidates.length
          : 0,
        retrievalTimeMs: Date.now() - startMs,
        retrievalCost: embeddingCost,
      },
    };
  } catch (e) {
    console.error("[stage1] Unexpected error:", e);
    return emptyResult(request, startMs);
  }
}

// ─── Fallbacks ───

function emptyResult(request: GenerationRequest, startMs: number): BlockRetrievalResult {
  return {
    request,
    candidates: [],
    retrievalMetrics: {
      totalBlocksSearched: 0,
      candidatesReturned: 0,
      avgRelevanceScore: 0,
      retrievalTimeMs: Date.now() - startMs,
      retrievalCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
    },
  };
}

async function buildTextOnlyResult(
  request: GenerationRequest,
  profile: FormatProfile,
  config: RetrievalConfig,
  startMs: number
): Promise<BlockRetrievalResult> {
  // Fallback: text-only matching without embeddings
  try {
    let query = config.supabase
      .from("activity_blocks")
      .select("*")
      .eq("is_archived", false)
      .limit(50);

    if (config.visibility === "private") {
      query = query.eq("teacher_id", config.teacherId);
    }

    const { data } = await query;
    const blocks = (data || []) as ActivityBlock[];

    if (blocks.length === 0) return emptyResult(request, startMs);

    const maxTimesUsed = Math.max(1, ...blocks.map(b => b.times_used));
    const candidates: RetrievedBlock[] = blocks.map(block => {
      const textMatch = computeTextMatch(block, request.topic);
      const efficacyNormalized = block.efficacy_score / 100;
      const metadataFit = computeMetadataFit(block, profile, request);
      const usageSignal = computeUsageSignal(block.times_used, maxTimesUsed);
      const vectorSimilarity = textMatch; // No real embedding available

      const relevanceScore =
        0.35 * vectorSimilarity +
        0.20 * efficacyNormalized +
        0.20 * metadataFit +
        0.15 * textMatch +
        0.10 * usageSignal;

      return {
        block,
        relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
        scoreBreakdown: { vectorSimilarity, efficacyNormalized, textMatch, usageSignal, metadataFit },
      };
    })
      .filter(c => c.relevanceScore >= 0.15)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, config.maxCandidates ?? 30);

    return {
      request,
      candidates,
      retrievalMetrics: {
        totalBlocksSearched: blocks.length,
        candidatesReturned: candidates.length,
        avgRelevanceScore: candidates.length > 0
          ? candidates.reduce((s, c) => s + c.relevanceScore, 0) / candidates.length
          : 0,
        retrievalTimeMs: Date.now() - startMs,
        retrievalCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
      },
    };
  } catch {
    return emptyResult(request, startMs);
  }
}
