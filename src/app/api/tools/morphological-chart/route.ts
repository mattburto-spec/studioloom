/**
 * Morphological Chart Toolkit AI API
 *
 * Two interaction modes:
 *   1. "nudge"    — Effort-gated feedback on combo ideas (ideation phase)
 *   2. "insights" — Synthesis of unusual/promising combinations
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

function buildNudgeSystemPrompt(effortLevel: "low" | "medium" | "high"): string {
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The idea is brief or vague.
- Do NOT praise a vague idea
- Push them to flesh it out: what does this look like? who would use it? what's special about it?
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The idea shows decent effort.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Encourage them to push FURTHER: what if you took this idea even more extreme?
- Ask "what's the most unexpected version of this?"`,
    high: `EFFORT LEVEL: HIGH — The idea is detailed and thoughtful.
- The "acknowledgment" should celebrate a SPECIFIC detail from their idea (3-8 words)
- Fuel their momentum: ask about variations or combinations with other ideas
- Push for creative leaps: "what if you combined this with another combination?"`,
  };

  return `You are an encouraging design thinking mentor. A student just created a concept from a morphological chart combination.

THIS IS IDEATION — keep creative momentum flowing, NOT evaluate ideas.
Never ask about flaws, feasibility, or trade-offs. That belongs in evaluation.
Your job is to help them EXPAND their thinking about this combination.

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback.

RULES:
- "acknowledgment": 3-8 word note referencing their specific idea (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- The question must ENCOURAGE them to explore the idea further
- Reference their specific concept
- Vary your approach — try "what if", "how might", "imagine if"

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Love the multi-material approach!", "nudge": "What if you took that material-mixing idea even further — could you use 5+ materials?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's morphological chart exploration. They combined design parameters in various ways and created concepts for each combination.

YOUR ROLE: Help the student see which combinations are most PROMISING, which are SURPRISING, and what these unusual pairings reveal about their design challenge.

RULES:
- Identify 2-3 combinations that are particularly interesting or novel
- Explain WHY each is interesting (unusual pairing, challenges assumptions, opens new direction, etc.)
- Point out ANY patterns in which parameter combinations work well together
- Ask 1 question: which of these concepts most excites you to develop further?
- Be encouraging
- Keep the whole response under 160 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC combinations and student ideas

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "morphological-chart", ["nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Effort-gated nudge ─── */
    if (action === "nudge") {
      const idea = (body.idea as string) ?? "";
      const combination = (body.combination || []) as string[];
      const parameters = (body.parameters || []) as string[];
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";

      if (!idea.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(effortLevel);
      const comboDescription = combination.join(" + ");
      const userPrompt = `Design challenge: "${challenge.trim()}"
Parameters: ${parameters.filter(p => p.trim()).join(", ")}
Combination: ${comboDescription}
Idea just added: "${idea.trim()}"

Respond with JSON feedback on this concept.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/morphological-chart/nudge", result, { sessionId, effortLevel, action: "nudge" });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const combinations = (body.combinations || []) as Array<{ combo: string[]; idea: string }>;
      const parameters = (body.parameters || []) as string[];

      if (!Array.isArray(combinations) || combinations.length === 0) {
        return Response.json({ insights: "" });
      }

      const systemPrompt = buildInsightsSystemPrompt();
      const combosWithIdeas = combinations.filter(c => c.idea?.trim());
      const combosSummary = combosWithIdeas
        .map((c, i) => {
          return `Combination ${i + 1}: ${c.combo.join(" + ")}\nIdea: ${c.idea}`;
        })
        .join("\n\n");

      const userPrompt = `Design challenge: "${challenge.trim()}"
Parameters: ${parameters.filter(p => p.trim()).join(", ")}

Student's morphological explorations (${combosWithIdeas.length} combinations):
${combosSummary}

What do these combinations reveal? Which are most promising or surprising?`;

      const result = await callHaiku(systemPrompt, userPrompt, 400);

      logToolkitUsage("tools/morphological-chart/insights", result, {
        sessionId,
        combinationCount: combosWithIdeas.length,
        action: "insights",
      });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("morphological-chart", err);
  }
}
