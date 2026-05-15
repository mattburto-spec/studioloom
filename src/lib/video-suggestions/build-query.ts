/**
 * Query builder — turns a SuggestionContext into a 6–10 word YouTube
 * search query via Haiku.
 *
 * Why Haiku: this call has no pedagogical reasoning. It just compresses
 * teacher-authored block context into a search-engine query. Cheap +
 * fast is the right trade.
 *
 * Returns `{ query, usage }` on success; an opaque Error on failure
 * (caller logs + falls back to a heuristic query so the feature
 * degrades gracefully rather than 500s the whole route).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import type { SuggestionContext } from "./types";

// Import from the central models registry so the render-path-fixtures
// guard (no hardcoded model IDs outside models.ts) stays green. Was a
// raw string in PR #281 which left CI red on main.
export const HAIKU_MODEL = MODELS.HAIKU;

const SYSTEM_PROMPT = `You compress a lesson activity into a short YouTube search query (6 to 10 words). The query should surface short educational videos suitable for secondary students aged 11 to 18.

Rules:
- Output ONLY the query string. No quotes, no punctuation other than spaces, no explanation.
- 6 to 10 words. No filler ("video", "lesson", "for kids" — let YouTube infer).
- Include the concrete skill or concept ("empathy interviews", "centre of mass") and grade-level cue if useful ("year 7" / "high school").
- Prefer terms a teacher would type, not student-speak.
- No channel names, no proper nouns unless they're the topic itself.`;

export function composeUserPrompt(ctx: SuggestionContext): string {
  const lines: string[] = [];
  if (ctx.unitTitle) lines.push(`Unit: ${ctx.unitTitle}`);
  if (ctx.subject) lines.push(`Subject: ${ctx.subject}`);
  if (ctx.gradeLevel) lines.push(`Grade level: ${ctx.gradeLevel}`);
  if (ctx.framing) lines.push(`Framing: ${ctx.framing}`);
  if (ctx.task) lines.push(`Task: ${ctx.task}`);
  if (ctx.success_signal) lines.push(`Success signal: ${ctx.success_signal}`);
  return lines.join("\n") + "\n\nReturn only the search query.";
}

export interface BuildQueryResult {
  query: string;
  /** Source — `ai` when the Haiku call succeeded, `heuristic` on fallback. */
  source: "ai" | "heuristic";
}

/**
 * Heuristic fallback: stitches the most-signal fields together. Used
 * when Haiku is unavailable or returns garbage so the route still
 * produces a useful query.
 */
export function heuristicQuery(ctx: SuggestionContext): string {
  // Order matters — grade and subject prefix narrows the search first.
  const parts: string[] = [];
  if (ctx.gradeLevel) parts.push(ctx.gradeLevel);
  if (ctx.subject) parts.push(ctx.subject);
  if (ctx.unitTitle) parts.push(ctx.unitTitle);
  // The framing/task slot often holds the actual learning verb.
  const body = (ctx.framing || ctx.task || "").split(/\s+/).slice(0, 6).join(" ");
  if (body) parts.push(body);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Sanitise the model's reply — strip quotes/leading punctuation,
 * collapse whitespace, hard-cap at 120 chars (YouTube ignores past
 * that anyway).
 */
export function sanitiseQuery(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // After trim — strip wrapping quotes (the model often quotes its own reply),
    // then trim once more in case there was inner whitespace right inside the quotes.
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .slice(0, 120);
}

export async function buildSearchQuery(
  ctx: SuggestionContext,
  opts: {
    supabase: SupabaseClient;
    teacherId: string;
  },
): Promise<BuildQueryResult> {
  const userPrompt = composeUserPrompt(ctx);

  const result = await callAnthropicMessages({
    endpoint: "teacher/suggest-videos:query",
    model: HAIKU_MODEL,
    supabase: opts.supabase,
    teacherId: opts.teacherId,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 60,
    temperature: 0.3,
    metadata: { phase: "query-builder" },
  });

  if (!result.ok) {
    console.warn(
      `[suggest-videos] query builder failed (${result.reason}); falling back to heuristic`,
    );
    return { query: heuristicQuery(ctx), source: "heuristic" };
  }

  const textBlock = result.response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  const sanitised = sanitiseQuery(raw);

  // Guard against pathological short replies (e.g. "ok") — fall back.
  if (sanitised.length < 4) {
    return { query: heuristicQuery(ctx), source: "heuristic" };
  }
  return { query: sanitised, source: "ai" };
}
