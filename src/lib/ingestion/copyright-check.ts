/**
 * Stage I-4b: Copyright Heuristic (deterministic, no AI)
 *
 * Phase 1.5 item 6. Detects verbatim chunks ≥ 200 characters that overlap
 * with content already in the activity_blocks corpus, and flips
 * `copyrightFlag` to 'copyrighted' on any block that hits. This is a
 * precision-biased heuristic — it only fires on long exact substrings, so
 * the false-positive rate is very low (a 200+ char verbatim match on
 * cleaned whitespace is effectively impossible by coincidence).
 *
 * Runs AFTER extract but BEFORE moderate. Moderation only reads title /
 * prompt / description, so it doesn't care about the copyright flip — but
 * downstream (review queue, commit) should see the final copyright state.
 *
 * Failure behaviour: if the DB is unreachable or returns an error, the
 * corpus is treated as empty and no blocks are flagged. The heuristic is
 * advisory — it must never block the pipeline.
 *
 * Naming note: the Phase 1.5 spec line references an
 * `is_copyright_flagged` boolean, but that column does not exist in the
 * schema (only the `copyright_flag` TEXT enum from migration 060). Rather
 * than add a parallel boolean, we reuse the enum: heuristic hits set
 * `copyrightFlag = 'copyrighted'`, matching the existing vocabulary.
 */

import type { CostBreakdown } from "@/types/activity-blocks";
import type { ExtractedBlock, PassConfig } from "./types";

const ZERO_COST: CostBreakdown = {
  inputTokens: 0,
  outputTokens: 0,
  modelId: "heuristic",
  estimatedCostUSD: 0,
  timeMs: 0,
};

/** Minimum verbatim run (post-whitespace-normalisation) that triggers a flag. */
export const COPYRIGHT_MIN_MATCH_CHARS = 200;

/** Rolling-window step. Smaller = more thorough, larger = faster. */
const WINDOW_STEP = 50;

/** Corpus cap: prevents runaway queries on large block libraries. */
const CORPUS_FETCH_LIMIT = 5000;

/**
 * Normalise text for substring comparison: lowercase, collapse whitespace, trim.
 * Case-insensitive — "Design A Package" and "design a package" are the same
 * content. The 200-char minimum already prevents false positives; adding
 * case-folding catches real copies with different capitalisation.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Pure detection function — testable without a DB.
 *
 * Walks a sliding window of `minChars` across the (normalised) input text
 * and checks whether any corpus entry contains that exact chunk. Returns
 * on the first hit for efficiency; callers that want exhaustive overlap
 * reports should iterate themselves.
 *
 * Complexity: O(windows × corpus × entry_length) worst case. With
 * WINDOW_STEP=50 and CORPUS_FETCH_LIMIT=5000 this stays well under 1s for
 * typical lesson-plan content.
 */
export function detectVerbatimOverlap(
  text: string,
  corpus: string[],
  minChars: number = COPYRIGHT_MIN_MATCH_CHARS
): { matched: boolean; snippet?: string } {
  if (!text || corpus.length === 0) return { matched: false };
  const normalised = normalise(text);
  if (normalised.length < minChars) return { matched: false };

  const normalisedCorpus = corpus
    .map(normalise)
    .filter((c) => c.length >= minChars);
  if (normalisedCorpus.length === 0) return { matched: false };

  for (let i = 0; i + minChars <= normalised.length; i += WINDOW_STEP) {
    const chunk = normalised.slice(i, i + minChars);
    for (const entry of normalisedCorpus) {
      if (entry.includes(chunk)) {
        return { matched: true, snippet: chunk };
      }
    }
  }
  // Catch the tail: if length isn't a clean multiple of the step, the
  // last window may not have been checked. Check the final minChars.
  const tail = normalised.slice(normalised.length - minChars);
  for (const entry of normalisedCorpus) {
    if (entry.includes(tail)) {
      return { matched: true, snippet: tail };
    }
  }

  return { matched: false };
}

export interface CopyrightCheckResult {
  blocks: ExtractedBlock[];
  flaggedCount: number;
  cost: CostBreakdown;
}

/**
 * Stage wrapper: fetches the corpus from `activity_blocks` (prompt +
 * description columns) and runs `detectVerbatimOverlap` against each
 * extracted block. Failure-safe — any DB error returns blocks unchanged.
 */
export async function checkBlocksForCopyright(
  blocks: ExtractedBlock[],
  config: PassConfig
): Promise<CopyrightCheckResult> {
  const startTime = Date.now();

  if (blocks.length === 0) {
    return {
      blocks,
      flaggedCount: 0,
      cost: { ...ZERO_COST, timeMs: Date.now() - startTime },
    };
  }

  // Fetch corpus. Failure-safe: on any error, corpus stays empty and the
  // heuristic becomes a no-op for this run.
  const corpus: string[] = [];
  if (config.supabaseClient) {
    try {
      const { data } = await config.supabaseClient
        .from("activity_blocks")
        .select("prompt, description")
        .limit(CORPUS_FETCH_LIMIT);
      if (Array.isArray(data)) {
        for (const row of data as Array<{ prompt?: unknown; description?: unknown }>) {
          if (typeof row.prompt === "string" && row.prompt.length > 0) {
            corpus.push(row.prompt);
          }
          if (typeof row.description === "string" && row.description.length > 0) {
            corpus.push(row.description);
          }
        }
      }
    } catch {
      // Swallowed deliberately — heuristic is advisory, don't block the pipeline.
    }
  }

  let flaggedCount = 0;
  const result = blocks.map((block) => {
    const combined = `${block.description}\n${block.prompt}`;
    const match = detectVerbatimOverlap(combined, corpus, COPYRIGHT_MIN_MATCH_CHARS);
    if (match.matched) {
      flaggedCount++;
      return {
        ...block,
        copyrightFlag: "copyrighted" as const,
        copyrightMatchedSnippet: match.snippet,
      };
    }
    return block;
  });

  return {
    blocks: result,
    flaggedCount,
    cost: { ...ZERO_COST, timeMs: Date.now() - startTime },
  };
}
