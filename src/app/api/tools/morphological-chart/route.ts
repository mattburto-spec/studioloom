/**
 * Morphological Chart Toolkit AI API
 *
 * Two interaction modes:
 *   1. "nudge"    — Effort-gated feedback on combo ideas (ideation phase)
 *   2. "insights" — Synthesis of unusual/promising combinations
 *
 * Uses Haiku 4.5 for speed.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

type ActionType = "nudge" | "insights";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  parameters?: string[];
  combination?: string[];
  idea?: string;
  effortLevel?: "low" | "medium" | "high";
  combinations?: Array<{ combo: string[]; idea: string }>;
}

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { action, challenge, sessionId } = body;

    if (!action || !challenge?.trim() || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: action, challenge, sessionId" },
        { status: 400 }
      );
    }

    const { allowed, retryAfterMs } = rateLimit(
      `morphological-chart:${sessionId}`,
      TOOLKIT_LIMITS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Take a moment to think, then try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)) } }
      );
    }

    /* ─── NUDGE ─── */
    if (action === "nudge") {
      const { combination = [], idea, parameters = [], effortLevel = "medium" } = body;
      if (!idea?.trim()) {
        return NextResponse.json({ error: "Missing idea" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(effortLevel);
      const comboDescription = combination.join(" + ");
      const userPrompt = `Design challenge: "${challenge.trim()}"
Parameters: ${parameters.filter(p => p.trim()).join(", ")}
Combination: ${comboDescription}
Idea just added: "${idea.trim()}"

Respond with JSON feedback on this concept.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);

      let nudgeText = result.text.trim();
      let acknowledgment = "";

      try {
        const jsonMatch = nudgeText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          nudgeText = parsed.nudge || nudgeText;
          acknowledgment = parsed.acknowledgment || "";
        }
      } catch {
        const nudgeMatch = nudgeText.match(/"nudge"\s*:\s*"([^"]+)"/);
        const ackMatch = nudgeText.match(/"acknowledgment"\s*:\s*"([^"]+)"/);
        if (nudgeMatch) nudgeText = nudgeMatch[1];
        if (ackMatch) acknowledgment = ackMatch[1];
      }

      logUsage({
        endpoint: "tools/morphological-chart/nudge",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, effortLevel, action: "nudge" },
      });

      return NextResponse.json({
        nudge: nudgeText,
        acknowledgment,
        effortLevel,
      });
    }

    /* ─── INSIGHTS ─── */
    if (action === "insights") {
      const { combinations = [], parameters = [] } = body;
      if (!Array.isArray(combinations) || combinations.length === 0) {
        return NextResponse.json({ insights: "" });
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

      logUsage({
        endpoint: "tools/morphological-chart/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, combinationCount: combosWithIdeas.length, action: "insights" },
      });

      return NextResponse.json({ insights: result.text.trim() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[morphological-chart] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Morphological Chart tool error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
