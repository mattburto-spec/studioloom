/**
 * infer-bloom.ts — Keyword heuristic to auto-detect Bloom's taxonomy level
 * from activity text (prompt, scaffolding, example response).
 *
 * Used by the lesson editor to auto-populate bloom_level on legacy activities
 * that were created before Dimensions Phase 4.
 *
 * Scoring: each keyword hit adds weight. Highest-scoring level wins.
 * Tie-breaking: higher-order level wins (Create > Evaluate > ... > Remember).
 *
 * Based on Bloom's Revised Taxonomy action verbs (Anderson & Krathwohl, 2001).
 */

import type { BloomLevel, ActivitySection } from "@/types";

// Keyword → Bloom level mapping with weights
// Higher weight = stronger signal (exact verb match vs. contextual word)
interface KeywordRule {
  pattern: RegExp;
  level: BloomLevel;
  weight: number;
}

const RULES: KeywordRule[] = [
  // ── Create (6) — synthesis, invention, original work ──
  { pattern: /\b(design|create|build|construct|develop|produce|compose|invent|devise|formulate|generate|author|assemble|craft)\b/i, level: "create", weight: 3 },
  { pattern: /\b(prototype|sketch|make|fabricate|model|draft|plan)\b/i, level: "create", weight: 2 },
  { pattern: /\b(original|innovative|novel|unique|your own|from scratch)\b/i, level: "create", weight: 1.5 },
  { pattern: /\b(brainstorm|ideate|imagine|envision)\b/i, level: "create", weight: 2 },

  // ── Evaluate (5) — judgment, critique, assessment ──
  { pattern: /\b(evaluate|assess|judge|critique|justify|defend|argue|recommend|prioriti[sz]e|rank|rate)\b/i, level: "evaluate", weight: 3 },
  { pattern: /\b(appraise|conclude|determine|decide|select the best|which is better)\b/i, level: "evaluate", weight: 2 },
  { pattern: /\b(strengths? and weaknesses?|pros? and cons?|advantages? and disadvantages?|trade-?offs?)\b/i, level: "evaluate", weight: 2.5 },
  { pattern: /\b(rubric|criteria|feedback|peer review|self-assess)\b/i, level: "evaluate", weight: 1.5 },

  // ── Analyze (4) — breaking down, relationships, structure ──
  { pattern: /\b(analy[sz]e|examine|investigate|inspect|compare|contrast|differentiate|distinguish|deconstruct)\b/i, level: "analyze", weight: 3 },
  { pattern: /\b(categorize|classify|organize|sort|break down|dissect|map out)\b/i, level: "analyze", weight: 2 },
  { pattern: /\b(relationship|connection|pattern|cause and effect|root cause|why does|how does)\b/i, level: "analyze", weight: 1.5 },
  { pattern: /\b(stakeholder|user needs?|target audience|empathy map|five whys)\b/i, level: "analyze", weight: 2 },

  // ── Apply (3) — using knowledge in context ──
  { pattern: /\b(apply|use|implement|execute|carry out|demonstrate|solve|calculate|compute|operate)\b/i, level: "apply", weight: 3 },
  { pattern: /\b(practice|experiment|test|try|hands-on|workshop|make|measure)\b/i, level: "apply", weight: 2 },
  { pattern: /\b(follow the steps|using the|with the tool|complete the)\b/i, level: "apply", weight: 1.5 },
  { pattern: /\b(simulation|role-?play|scenario|case study)\b/i, level: "apply", weight: 1.5 },

  // ── Understand (2) — comprehension, interpretation ──
  { pattern: /\b(explain|describe|discuss|interpret|summarize|paraphrase|clarify|illustrate)\b/i, level: "understand", weight: 3 },
  { pattern: /\b(in your own words|what does .+ mean|give an example|rephrase)\b/i, level: "understand", weight: 2 },
  { pattern: /\b(predict|infer|estimate|extend|elaborate|translate)\b/i, level: "understand", weight: 2 },
  { pattern: /\b(overview|introduction|context|background)\b/i, level: "understand", weight: 1 },

  // ── Remember (1) — recall, recognition ──
  { pattern: /\b(list|name|define|identify|recall|recogni[sz]e|label|state|match|memorize)\b/i, level: "remember", weight: 3 },
  { pattern: /\b(what is|who is|when did|where is|how many|true or false)\b/i, level: "remember", weight: 2 },
  { pattern: /\b(vocabulary|terms|facts|definitions)\b/i, level: "remember", weight: 1.5 },
];

// Level ordering for tie-breaking (higher index = higher order)
const LEVEL_ORDER: BloomLevel[] = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

/**
 * Extract all text signals from an activity section.
 */
function extractText(activity: ActivitySection): string {
  const parts: string[] = [];
  if (activity.prompt) parts.push(activity.prompt);
  if (activity.exampleResponse) parts.push(activity.exampleResponse);
  if (activity.scaffolding) {
    // EllScaffolding has tiered structure: ell1, ell2, ell3
    const s = activity.scaffolding;
    if (s.ell1?.sentenceStarters) parts.push(s.ell1.sentenceStarters.join(" "));
    if (s.ell1?.hints) parts.push(s.ell1.hints.join(" "));
    if (s.ell2?.sentenceStarters) parts.push(s.ell2.sentenceStarters.join(" "));
    if (s.ell3?.extensionPrompts) parts.push(s.ell3.extensionPrompts.join(" "));
  }
  if (activity.success_look_fors) {
    parts.push(activity.success_look_fors.join(" "));
  }
  // Include tool info if it's a toolkit activity
  if (activity.toolId) parts.push(activity.toolId);
  if (activity.toolChallenge) parts.push(activity.toolChallenge);
  return parts.join(" ");
}

/**
 * Infer the most likely Bloom's level from activity text using keyword heuristics.
 * Returns null if confidence is too low (fewer than 2 total weight points).
 */
export function inferBloomLevel(activity: ActivitySection): BloomLevel | null {
  const text = extractText(activity);
  if (!text || text.length < 10) return null;

  // Score each level
  const scores: Record<BloomLevel, number> = {
    remember: 0,
    understand: 0,
    apply: 0,
    analyze: 0,
    evaluate: 0,
    create: 0,
  };

  for (const rule of RULES) {
    // Count all matches (not just first)
    const matches = text.match(new RegExp(rule.pattern.source, "gi"));
    if (matches) {
      scores[rule.level] += rule.weight * matches.length;
    }
  }

  // Find the highest scoring level
  let bestLevel: BloomLevel | null = null;
  let bestScore = 0;

  for (const level of LEVEL_ORDER) {
    // >= means higher-order wins ties (LEVEL_ORDER is ascending)
    if (scores[level] >= bestScore && scores[level] > 0) {
      bestScore = scores[level];
      bestLevel = level;
    }
  }

  // Minimum confidence threshold — need at least 2 weight points
  if (bestScore < 2) return null;

  return bestLevel;
}

/**
 * Infer Bloom's levels for all activities in a section list.
 * Only returns suggestions for activities that don't already have bloom_level set.
 * Returns a map of activity index → inferred BloomLevel.
 */
export function inferBloomLevelsForPage(
  sections: ActivitySection[]
): Map<number, BloomLevel> {
  const suggestions = new Map<number, BloomLevel>();

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    // Skip if already has bloom_level
    if (section.bloom_level) continue;

    const inferred = inferBloomLevel(section);
    if (inferred) {
      suggestions.set(i, inferred);
    }
  }

  return suggestions;
}

/**
 * Auto-populate bloom_level on activities that don't have it.
 * Returns a new sections array with bloom_level set on applicable activities.
 * Activities that already have bloom_level are unchanged.
 * Activities where inference fails (low confidence) are also unchanged.
 */
export function autoPopulateBloomLevels(
  sections: ActivitySection[]
): { sections: ActivitySection[]; populatedCount: number } {
  let populatedCount = 0;

  const newSections = sections.map((section) => {
    if (section.bloom_level) return section; // already set

    const inferred = inferBloomLevel(section);
    if (!inferred) return section; // can't infer

    populatedCount++;
    return { ...section, bloom_level: inferred };
  });

  return { sections: newSections, populatedCount };
}
