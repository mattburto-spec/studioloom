/**
 * Data access layer for the Activity Cards system.
 *
 * All DB queries go through here. Consumers import from this module
 * instead of directly querying Supabase.
 *
 * Provides a backward-compatibility bridge via `toActivityTemplate()`
 * so existing sidebar/browser consumers work unchanged during migration.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { embedText } from "@/lib/ai/embeddings";
import { ACTIVITY_LIBRARY, type ActivityTemplate } from "@/lib/activity-library";
import type {
  ActivityCard,
  ActivityCardFilters,
  CardTemplate,
  CardAIHints,
  CardRecommendation,
} from "@/types/activity-cards";
// Note: CriterionKey import removed — activity cards use generic strings
// for criteria to support multiple curriculum frameworks.

// ---------------------------------------------------------------------------
// Backward-compat bridge: convert DB card → old ActivityTemplate shape
// ---------------------------------------------------------------------------

const MINUTES_TO_DURATION: Record<number, ActivityTemplate["tags"]["duration"]> = {
  5: "5min",
  10: "10min",
  15: "15min",
  20: "20min",
  30: "30min+",
};

export function toActivityTemplate(card: ActivityCard): ActivityTemplate {
  const template = card.template as CardTemplate;
  const aiHints = card.ai_hints as CardAIHints;

  return {
    id: card.slug,
    name: card.name,
    description: card.description,
    category: card.category as ActivityTemplate["category"],
    tags: {
      criteria: card.criteria as ActivityTemplate["tags"]["criteria"],
      phases: card.phases,
      thinkingType: card.thinking_type as ActivityTemplate["tags"]["thinkingType"],
      duration: MINUTES_TO_DURATION[card.duration_minutes] || "15min",
      groupSize: card.group_size as ActivityTemplate["tags"]["groupSize"],
    },
    template: {
      sections: template.sections || [],
      vocabTerms: template.vocabTerms,
      reflection: template.reflection,
    },
    aiHints: {
      whenToUse: aiHints.whenToUse || "",
      topicAdaptation: aiHints.topicAdaptation || "",
    },
  };
}

// ---------------------------------------------------------------------------
// List / filter cards
// ---------------------------------------------------------------------------

export async function getActivityCards(
  filters?: ActivityCardFilters
): Promise<ActivityCard[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("activity_cards")
    .select("*")
    .eq("is_public", true)
    .order("category")
    .order("name");

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  if (filters?.criterion) {
    query = query.contains("criteria", [filters.criterion]);
  }
  if (filters?.thinkingType) {
    query = query.eq("thinking_type", filters.thinkingType);
  }
  if (filters?.groupSize) {
    query = query.eq("group_size", filters.groupSize);
  }
  if (filters?.maxDuration) {
    query = query.lte("duration_minutes", filters.maxDuration);
  }
  if (filters?.minDuration) {
    query = query.gte("duration_minutes", filters.minDuration);
  }
  if (filters?.source) {
    query = query.eq("source", filters.source);
  }

  // Text search via Postgres FTS
  if (filters?.search) {
    query = query.textSearch("fts", filters.search, {
      type: "websearch",
      config: "english",
    });
  }

  const { data, error } = await query;

  if (error) {
    console.error("[activity-cards] List error:", error.message);
    return [];
  }

  return (data || []) as ActivityCard[];
}

// ---------------------------------------------------------------------------
// Get a single card by slug
// ---------------------------------------------------------------------------

export async function getActivityCardBySlug(
  slug: string
): Promise<ActivityCard | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("activity_cards")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("[activity-cards] Fetch error:", error.message);
    return null;
  }

  return data as ActivityCard;
}

// ---------------------------------------------------------------------------
// Get a single card by UUID
// ---------------------------------------------------------------------------

export async function getActivityCardById(
  id: string
): Promise<ActivityCard | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("activity_cards")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[activity-cards] Fetch error:", error.message);
    return null;
  }

  return data as ActivityCard;
}

// ---------------------------------------------------------------------------
// Semantic search (hybrid: embedding + FTS + usage)
// ---------------------------------------------------------------------------

export async function searchActivityCards(
  query: string,
  filters?: ActivityCardFilters,
  maxResults = 20
): Promise<ActivityCard[]> {
  // Generate query embedding
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch (err) {
    console.warn("[activity-cards] Embedding failed, falling back to FTS:", err);
    // Fall back to text-only search
    return getActivityCards({ ...filters, search: query });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_activity_cards", {
    query_embedding: `[${queryEmbedding.join(",")}]`,
    query_text: query,
    match_count: maxResults,
    filter_category: filters?.category || null,
    filter_criterion: filters?.criterion || null,
    filter_thinking_type: filters?.thinkingType || null,
    filter_group_size: filters?.groupSize || null,
    filter_max_duration: filters?.maxDuration || null,
    filter_source: filters?.source || null,
  });

  if (error) {
    console.error("[activity-cards] Search error:", error.message);
    return [];
  }

  return (data || []) as ActivityCard[];
}

// ---------------------------------------------------------------------------
// Record usage event
// ---------------------------------------------------------------------------

export async function recordActivityUsage(params: {
  cardId: string;
  teacherId: string;
  unitId?: string;
  pageId?: string;
  criterion?: string;
  modifiersApplied?: Record<string, string | boolean>;
  customPrompt?: string;
  sectionsBefore?: unknown[];
  sectionsAfter?: unknown[];
}): Promise<void> {
  const supabase = createAdminClient();

  // Insert usage record
  const { error: usageError } = await supabase
    .from("activity_card_usage")
    .insert({
      card_id: params.cardId,
      teacher_id: params.teacherId,
      unit_id: params.unitId || null,
      page_id: params.pageId || null,
      criterion: params.criterion || null,
      modifiers_applied: params.modifiersApplied || null,
      custom_prompt: params.customPrompt || null,
      sections_before: params.sectionsBefore || null,
      sections_after: params.sectionsAfter || null,
    });

  if (usageError) {
    console.error("[activity-cards] Usage tracking error:", usageError.message);
  }

  // Increment card usage count (fire-and-forget)
  supabase
    .rpc("increment_activity_card_usage", { card_uuid: params.cardId })
    .then(({ error }) => {
      if (error) console.error("[activity-cards] Increment error:", error.message);
    });
}

// ---------------------------------------------------------------------------
// Get cards as ActivityTemplate[] (backward compat for existing consumers)
// Falls back to hardcoded library if DB is unavailable.
// ---------------------------------------------------------------------------

export async function getActivityTemplatesFromDB(): Promise<ActivityTemplate[]> {
  try {
    const cards = await getActivityCards();
    if (cards.length === 0) {
      // DB empty or unavailable — use hardcoded fallback
      return ACTIVITY_LIBRARY;
    }
    return cards.map(toActivityTemplate);
  } catch {
    // DB error — use hardcoded fallback
    return ACTIVITY_LIBRARY;
  }
}

// ---------------------------------------------------------------------------
// Build AI prompt summary from DB cards (replaces getActivityLibrarySummary)
// ---------------------------------------------------------------------------

export async function getActivityCardSummary(
  criterion?: string
): Promise<string> {
  try {
    const filters: ActivityCardFilters = {};
    if (criterion) filters.criterion = criterion;
    const cards = await getActivityCards(filters);

    if (cards.length === 0) {
      // Fallback to hardcoded (legacy library still uses CriterionKey type)
      const { getActivityLibrarySummary } = await import("@/lib/activity-library");
      return getActivityLibrarySummary(criterion as "A" | "B" | "C" | "D" | undefined);
    }

    return cards
      .map((c) => {
        const hints = c.ai_hints as CardAIHints;
        return `- ${c.name} (${c.slug}): ${hints.whenToUse || c.description}`;
      })
      .join("\n");
  } catch {
    // Fallback to hardcoded (legacy library still uses CriterionKey type)
    const { getActivityLibrarySummary } = await import("@/lib/activity-library");
    return getActivityLibrarySummary(criterion as "A" | "B" | "C" | "D" | undefined);
  }
}

// ---------------------------------------------------------------------------
// Build enriched activity card summary with modifier details for AI prompts.
// Provides enough info for the AI to SELECT a specific card and its modifiers.
// ---------------------------------------------------------------------------

export async function getActivityCardSummaryEnriched(
  criterion?: string
): Promise<string> {
  try {
    const filters: ActivityCardFilters = {};
    if (criterion) filters.criterion = criterion;
    const cards = await getActivityCards(filters);

    if (cards.length === 0) {
      // Fallback to hardcoded
      const { getActivityLibrarySummary } = await import("@/lib/activity-library");
      return getActivityLibrarySummary(criterion as "A" | "B" | "C" | "D" | undefined);
    }

    return cards
      .map((c) => {
        const hints = c.ai_hints as CardAIHints;
        const modifierInfo =
          hints.modifierAxes && hints.modifierAxes.length > 0
            ? ` [Modifiers: ${hints.modifierAxes.map((a) => `${a.label} (${a.type === "select" && a.options ? a.options.map((o) => o.label).join("/") : "on/off"})`).join(", ")}]`
            : "";
        return `- ${c.name} (${c.slug}, ${c.duration_minutes}min, ${c.group_size}): ${hints.whenToUse || c.description}${modifierInfo}`;
      })
      .join("\n");
  } catch {
    const { getActivityLibrarySummary } = await import("@/lib/activity-library");
    return getActivityLibrarySummary(criterion as "A" | "B" | "C" | "D" | undefined);
  }
}

// ---------------------------------------------------------------------------
// Auto-recommend: pick best activity cards for generated unit pages
// ---------------------------------------------------------------------------

/**
 * Scores each activity card against a page based on criterion match,
 * page-reference hints in `whenToUse`, and keyword overlap.
 *
 * Uses local heuristics (no API calls) for fast recommendations.
 * Cards are scored per page and de-duplicated so the same card isn't
 * recommended twice across different pages.
 */
export async function recommendCardsForPages(
  pages: Record<
    string,
    { title: string; learningGoal: string; sections: Array<{ prompt: string }> }
  >,
  unitContext: { topic: string; gradeLevel?: string }
): Promise<CardRecommendation[]> {
  // 1. Fetch all public cards from DB
  const allCards = await getActivityCards();
  if (allCards.length === 0) return [];

  const recommendations: CardRecommendation[] = [];
  const usedCardIds = new Set<string>();

  // 2. Process pages in order (A1, A2, ..., D4)
  const sortedPages = Object.entries(pages)
    .filter(([, page]) => page != null)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [pageId, page] of sortedPages) {
    const criterion = pageId.charAt(0); // "A", "B", "C", "D"
    const pageIndex = pageId.charAt(1); // "1", "2", "3", "4"

    // Score each unused card for this page
    const scored = allCards
      .filter((c) => !usedCardIds.has(c.id))
      .map((card) => {
        const aiHints = card.ai_hints as CardAIHints;
        const whenToUse = aiHints?.whenToUse || "";
        let score = 0;

        // ── Must match criterion (hard filter) ──
        if (!card.criteria.includes(criterion)) {
          return { card, score: 0 };
        }
        score += 10;

        // ── Exact page reference in whenToUse (e.g., "B2") ──
        const pageRef = `${criterion}${pageIndex}`;
        if (whenToUse.includes(pageRef)) {
          score += 8;
        }

        // ── Range references like "A1-A2", "C3-C4", "D1-D2" ──
        const rangeRegex = new RegExp(
          `${criterion}(\\d)[-–]${criterion}(\\d)`,
          "g"
        );
        let rangeMatch;
        while ((rangeMatch = rangeRegex.exec(whenToUse)) !== null) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          const idx = parseInt(pageIndex);
          if (idx >= start && idx <= end) {
            score += 6;
            break;
          }
        }

        // ── Phase overlap ──
        const pageText = `${page.title} ${page.learningGoal}`.toLowerCase();
        for (const phase of card.phases) {
          if (pageText.includes(phase.toLowerCase())) {
            score += 3;
          }
        }

        // ── Keyword overlap (card description ↔ page content) ──
        const cardKeywords = `${card.description} ${whenToUse} ${card.name}`
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 4);
        const topicWords = unitContext.topic.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
        const allPageWords = `${pageText} ${page.sections.map((s) => s.prompt).join(" ")}`.toLowerCase();

        // Card keywords matching page text
        const pageMatches = cardKeywords.filter((w) => allPageWords.includes(w));
        score += Math.min(pageMatches.length, 4);

        // Topic keywords matching card text
        const cardText = `${card.description} ${whenToUse}`.toLowerCase();
        const topicMatches = topicWords.filter((w) => cardText.includes(w));
        score += Math.min(topicMatches.length * 2, 4);

        // ── Popularity boost (slight) ──
        score += Math.min(card.times_used / 20, 1);

        return { card, score };
      })
      .filter((s) => s.score > 10) // Must at minimum match criterion
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) continue;

    const bestMatch = scored[0];
    const bestCard = bestMatch.card;
    const aiHints = bestCard.ai_hints as CardAIHints;

    // Avoid recommending the same card for multiple pages
    usedCardIds.add(bestCard.id);

    // Build default modifiers from the card's axes
    const suggestedModifiers: Record<string, string | boolean> = {};
    if (aiHints?.modifierAxes) {
      for (const axis of aiHints.modifierAxes) {
        suggestedModifiers[axis.id] = axis.default;
      }
    }

    recommendations.push({
      pageId,
      card: bestCard,
      suggestedModifiers,
      reason: aiHints?.whenToUse || bestCard.description,
    });
  }

  return recommendations;
}
