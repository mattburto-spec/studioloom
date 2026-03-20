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
 * Uses Haiku 4.5 for speed. Short responses only.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

type ActionType = "suggest-criteria" | "challenge" | "insights";

interface Score {
  optionId: string;
  criterionId: string;
  score: number;
  reasoning: string;
}

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

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  // For "suggest-criteria"
  existingCriteria?: string[];
  // For "challenge"
  criterion?: string;
  reasoning?: string;
  option?: string;
  effortLevel?: string;
  // For "insights"
  options?: string[];
  criteria?: Criterion[];
  scores?: Score[];
  rankedOptions?: RankedOption[];
}

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

${effortStrategy[effortLevel]}

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

async function callHaiku(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI service not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI call failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

  return {
    text: textBlock?.text || "",
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

function parseJSON<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch {
    // Try regex extraction
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { action, challenge, sessionId } = body;

    // Rate limit
    if (!rateLimit(sessionId, TOOLKIT_LIMITS)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    // ─────────────────────────── suggest-criteria ───────────────────────────
    if (action === "suggest-criteria") {
      const { existingCriteria = [] } = body;

      const userPrompt = `The student is trying to make this decision: "${challenge}"

Their existing criteria are: ${existingCriteria.length > 0 ? existingCriteria.join(", ") : "None yet"}

What important criteria might they have overlooked?`;

      const { text, inputTokens, outputTokens } = await callHaiku(
        buildSuggestCriteriaPrompt(),
        userPrompt,
        200
      );

      const suggestions = parseJSON(text, { suggestions: [] });

      // Log usage
      logUsage({
        model: "claude-haiku-4-5-20251001",
        inputTokens,
        outputTokens,
        tool: "decision-matrix",
        action: "suggest-criteria",
      });

      return NextResponse.json(suggestions);
    }

    // ─────────────────────────── challenge ───────────────────────────
    if (action === "challenge") {
      const { criterion, reasoning, option, effortLevel = "medium" } = body;

      const userPrompt = `The student is scoring the option "${option}" on the criterion "${criterion}".

Their reasoning: "${reasoning}"

Challenge the quality of their reasoning. Push for more specificity, evidence, or deeper thinking.`;

      const { text, inputTokens, outputTokens } = await callHaiku(
        buildChallengePrompt(effortLevel),
        userPrompt,
        150
      );

      const nudgeResponse = parseJSON(text, {
        acknowledgment: "",
        nudge: "Can you add more specific reasoning or evidence?",
        effortLevel,
      });

      // Log usage
      logUsage({
        model: "claude-haiku-4-5-20251001",
        inputTokens,
        outputTokens,
        tool: "decision-matrix",
        action: "challenge",
      });

      return NextResponse.json(nudgeResponse);
    }

    // ─────────────────────────── insights ───────────────────────────
    if (action === "insights") {
      const { options: optionNames = [], criteria: criteriaList = [], rankedOptions = [] } = body;

      const winner = rankedOptions[0];
      const topThree = rankedOptions.slice(0, 3);

      const userPrompt = `The student completed a Decision Matrix for this decision: "${challenge}"

Options evaluated: ${optionNames.join(", ")}
Criteria: ${criteriaList.map(c => `${c.name} (weight: ${c.weight})`).join(", ")}

Results:
${topThree.map(r => `${r.rank}. ${r.name}: ${r.weighted.toFixed(2)}/5`).join("\n")}

Analyze the patterns in their decision and what this matrix reveals about their priorities.`;

      const { text, inputTokens, outputTokens } = await callHaiku(
        buildInsightsPrompt(),
        userPrompt,
        350
      );

      // Log usage
      logUsage({
        model: "claude-haiku-4-5-20251001",
        inputTokens,
        outputTokens,
        tool: "decision-matrix",
        action: "insights",
      });

      return NextResponse.json({ insights: text });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in decision-matrix API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
