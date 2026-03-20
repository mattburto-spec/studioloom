/**
 * Decision Matrix Toolkit AI API
 *
 * Three interaction modes:
 *   1. "suggest-criteria" — Suggest criteria the student may have missed
 *   2. "challenge"        — Challenge the reasoning quality for a score
 *   3. "insights"         — Analyze scoring patterns and trade-offs
 *
 * Education AI patterns:
 *   - Effort-gating: assess reasoning quality before offering feedback
 *   - Socratic feedback: challenge scoring consistency and reasoning depth
 *   - Phase-aware tone: convergent analysis (evaluation phase)
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

// ─── Tool-specific types ───

interface Criterion {
  name: string;
  weight: number;
}

interface RankedOption {
  optionId: string;
  name: string;
  weighted: number;
  rank: number;
}

// ─── Tool-specific prompt builders ───

function buildSuggestCriteriaPrompt(): string {
  return `You are a design thinking mentor helping a student build a rigorous Decision Matrix.

Your role: Suggest 3-4 important criteria the student may have overlooked based on their design challenge.

RULES:
- Suggest criteria that are commonly important in design decisions (cost, durability, user impact, sustainability, feasibility, safety, etc.)
- Only suggest criteria NOT already in their existing criteria list
- Focus on criteria that would reveal important trade-offs
- Avoid generic criteria like "aesthetics" or "quality" — be specific
- Each criterion should take 2-4 words to name

RESPONSE FORMAT: Return a JSON object with one field:
{"suggestions": ["Criterion Name", "Another Criterion", "Third Criterion"]}

Nothing else. No explanation.`;
}

function buildChallengePrompt(effortLevel: string): string {
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The reasoning is brief or missing specific details.
- Do NOT praise weak reasoning — stay warm but direct
- Challenge them to add specifics: "What evidence supports that score?"
- Push for concrete examples or data points
- The "acknowledgment" MUST be an empty string`,
    medium: `EFFORT LEVEL: MEDIUM — The reasoning shows decent effort and some specificity.
- The "acknowledgment" should note ONE detail they included (3-8 words)
- Challenge them to go deeper: "What specific evidence or examples back that up?"
- Ask about edge cases or assumptions`,
    high: `EFFORT LEVEL: HIGH — The reasoning is specific and detailed.
- The "acknowledgment" should celebrate a specific detail (3-8 words)
- Push for second-order thinking: "Given that, how does this affect the overall decision?"
- Ask about trade-offs: "Does this score assume something that might not hold in all contexts?"`,
  };

  return `You are a rigorous design thinking mentor. A student just provided reasoning for a score on a Decision Matrix.

THIS IS EVALUATION — your job is to push for rigorous thinking, not to praise or criticize.
Challenge assumptions. Ask about evidence. Push for trade-offs.

${effortStrategy[effortLevel] || effortStrategy.medium}

YOUR ROLE: Return a JSON object with your feedback. Keep the tone constructive and intellectually rigorous.

RULES:
- "acknowledgment": 3-8 word note referencing their specific reasoning (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- The question must CHALLENGE their reasoning or push for deeper evidence
- Reference the specific criterion and option they're evaluating
- Vary your approach — try "what if", "what evidence", "what about"

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Good point about durability.", "nudge": "What specific testing or durability data supports that score?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you give a specific example or piece of evidence that backs that score?"}`;
}

function buildInsightsPrompt(): string {
  return `You are a design thinking mentor analyzing a student's completed Decision Matrix.

Your role: Help the student understand patterns in their scoring and what the matrix reveals about their values and priorities.

ANALYSIS TASKS:
1. Identify the winner and why it won (which criteria weighted most heavily in favor)
2. Spot any close calls or tight races between options
3. Identify any scoring patterns: Did they rate all options similarly? Did they favor one dimension?
4. Surface any potential biases: Does their scoring align with what they said their priorities were?
5. Ask one provocative question about what the matrix reveals about their decision-making

RULES:
- Keep the response under 200 words
- Use simple, clear language for ages 11-18
- Never tell them which option is "best" — help them understand the trade-offs
- Be honest: if scoring seems inconsistent or biased, gently point it out
- Focus on what the matrix teaches them about making rigorous decisions

RESPONSE FORMAT: 2-3 short paragraphs of plain text. Use no headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "decision-matrix", ["suggest-criteria", "challenge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Suggest criteria ─── */
    if (action === "suggest-criteria") {
      const existingCriteria = (body.existingCriteria || []) as string[];

      const userPrompt = `The student is trying to make this decision: "${challenge}"

Their existing criteria are: ${existingCriteria.length > 0 ? existingCriteria.join(", ") : "None yet"}

What important criteria might they have overlooked?`;

      const result = await callHaiku(buildSuggestCriteriaPrompt(), userPrompt, 200);
      const suggestions = parseToolkitJSON(result.text, { suggestions: [] });

      logToolkitUsage("tools/decision-matrix/suggest-criteria", result, { sessionId, action: "suggest-criteria" });

      return Response.json(suggestions);
    }

    /* ─── Action: Challenge reasoning ─── */
    if (action === "challenge") {
      const criterion = (body.criterion as string) ?? "";
      const reasoning = (body.reasoning as string) ?? "";
      const option = (body.option as string) ?? "";
      const effortLevel = (body.effortLevel as string) || "medium";

      const userPrompt = `The student is scoring the option "${option}" on the criterion "${criterion}".

Their reasoning: "${reasoning}"

Challenge the quality of their reasoning. Push for more specificity, evidence, or deeper thinking.`;

      const result = await callHaiku(buildChallengePrompt(effortLevel), userPrompt, 150);
      const nudgeResponse = parseToolkitJSON(result.text, {
        acknowledgment: "",
        nudge: "Can you add more specific reasoning or evidence?",
        effortLevel,
      });

      logToolkitUsage("tools/decision-matrix/challenge", result, { sessionId, action: "challenge" });

      return Response.json(nudgeResponse);
    }

    /* ─── Action: Analyze patterns ─── */
    if (action === "insights") {
      const optionNames = (body.options || []) as string[];
      const criteriaList = (body.criteria || []) as Criterion[];
      const rankedOptions = (body.rankedOptions || []) as RankedOption[];

      const winner = rankedOptions[0];
      const topThree = rankedOptions.slice(0, 3);

      const userPrompt = `The student completed a Decision Matrix for this decision: "${challenge}"

Options evaluated: ${optionNames.join(", ")}
Criteria: ${criteriaList.map(c => `${c.name} (weight: ${c.weight})`).join(", ")}

Results:
${topThree.map(r => `${r.rank}. ${r.name}: ${r.weighted.toFixed(2)}/5`).join("\n")}

Analyze the patterns in their decision and what this matrix reveals about their priorities.`;

      const result = await callHaiku(buildInsightsPrompt(), userPrompt, 350);

      logToolkitUsage("tools/decision-matrix/insights", result, { sessionId, action: "insights" });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("decision-matrix", err);
  }
}
