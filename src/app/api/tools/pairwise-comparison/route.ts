/**
 * Pairwise Comparison Toolkit AI API
 *
 * 2 steps: List Options → Compare Pairs
 * KEY: This is a SYSTEMATIC DECISION tool.
 * The pedagogical magic is in detecting CIRCULAR PREFERENCES — when students' preferences
 * aren't transitive (A > B, B > C, C > A). This is where real learning happens.
 *
 * One interaction mode:
 *   1. "analysis" — Cross-option synthesis + ranking + detection of inconsistencies
 *
 * Uses shared toolkit helpers — see src/lib/toolkit/shared-api.ts
 */

import { NextRequest } from "next/server";
import {
  callHaiku,
  validateToolkitRequest,
  parseToolkitJSON,
  logToolkitUsage,
  toolkitErrorResponse,
} from "@/lib/toolkit";

// ─── Tool-specific prompt builders ───

function buildAnalysisSystemPrompt(): string {
  return `You are a decision-making mentor analyzing a student's pairwise comparison results.

The student has compared multiple options head-to-head and you need to synthesize the results.

YOUR ROLE: Analyze the final ranking and explain:
1. The overall winner and why it dominated
2. Clear winners vs close calls
3. Any patterns in how they made decisions
4. Whether their preferences seem consistent or if there are contradictions

RULES:
- Be specific about win counts and head-to-head matchups
- Reference their actual stated reasoning when explaining patterns
- If there are ties or close calls, acknowledge the difficulty of the decision
- Keep language accessible (ages 11-18)
- Don't suggest they change their answers — just explain what the data shows

RESPONSE FORMAT: Return JSON with:
{
  "analysis": "2-3 sentences about the overall winner, any patterns, and decision quality"
}`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "pairwise-comparison", ["analysis"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Analysis synthesis ─── */
    if (action === "analysis") {
      const { options = [], comparisons = [] } = body;
      if (!Array.isArray(options) || !Array.isArray(comparisons) || options.length === 0 || comparisons.length === 0) {
        return Response.json({ error: "Missing options or comparisons" }, { status: 400 });
      }

      // Calculate win counts
      const winCounts: Record<string, number> = {};
      (options as string[]).forEach((opt) => {
        winCounts[opt] = (comparisons as Array<{ winner: string }>).filter((c) => c.winner === opt).length;
      });

      // Identify top 3
      const ranked = (options as string[])
        .map((opt) => ({ option: opt, wins: winCounts[opt] }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 3);

      // Build comparison summary for AI
      const comparisonSummary = (comparisons as Array<{ optionA: string; optionB: string; winner: string; reasoning: string }>)
        .map((c) => `${c.optionA} vs ${c.optionB}: ${c.winner} won (${c.reasoning})`)
        .join("\n");

      const userPrompt = `Decision: "${challenge}"

Options ranked by wins:
${ranked.map((r) => `${r.option}: ${r.wins} wins`).join("\n")}

All comparisons:
${comparisonSummary}

Analyze this pairwise comparison and explain the results.`;

      const result = await callHaiku(buildAnalysisSystemPrompt(), userPrompt, 200);
      const parsed = parseToolkitJSON(result.text, { analysis: result.text.trim() });

      logToolkitUsage("tools/pairwise-comparison/analysis", result, {
        sessionId,
        optionCount: options.length,
        action: "analysis",
      });

      return Response.json({
        analysis: parsed.analysis || result.text.trim(),
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("pairwise-comparison", err);
  }
}
