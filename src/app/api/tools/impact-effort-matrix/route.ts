/**
 * Impact/Effort Matrix Toolkit AI API
 *
 * 3 steps: List Ideas → Score Impact/Effort → Review Matrix
 * KEY: This is a PRIORITIZATION tool — convergent thinking helps filter the best options.
 * AI challenges questionable placements that don't align with stated reasoning.
 *
 * Two interaction modes:
 *   1. "nudge"          — Effort-gated feedback on scoring reasoning
 *   2. "recommendations" — Cross-idea synthesis + top 3 recommendation
 *
 * Uses Haiku 4.5 for speed. Focuses on decision-making clarity.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

type ActionType = "nudge" | "recommendations";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  idea?: string;
  effortLevel?: "low" | "medium" | "high";
  ideas?: Array<{ text: string; impact?: number; effort?: number; impactReasoning?: string; effortReasoning?: string }>;
}

// ─── Nudge Generation ───

function buildNudgeSystemPrompt(effortLevel: "low" | "medium" | "high"): string {
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's reasoning is brief or vague. Push for specifics.
- Do NOT praise vague reasoning — but stay warm and encouraging
- Ask them to be more specific: what specifically impacts it? what resources are needed?
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Deepen their analysis.
- The "acknowledgment" should note ONE specific factor they mentioned (3-8 words)
- Push them to consider: are there secondary impacts? other stakeholders? time horizon?`,
    high: `EFFORT LEVEL: HIGH — The student's reasoning is thorough and analytical. Challenge further.
- The "acknowledgment" should celebrate a SPECIFIC analytical insight (3-8 words)
- Push for: hidden assumptions, trade-offs, scenarios where their rating might shift`,
  };

  return `You are a design thinking mentor guiding a student through an Impact/Effort Matrix prioritization.

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive but analytical.

RULES:
- Keep responses short (1-2 sentences max)
- Push for clarity on what "impact" and "effort" actually mean
- Never suggest they change their score — only ask clarifying questions
- Reference their actual idea and context

RESPONSE FORMAT: Return JSON with exactly these fields:
{
  "acknowledgment": "What's good about their reasoning (or empty string if low effort)",
  "nudge": "Your clarifying question or push"
}`;
}

// ─── Recommendations Generation ───

function buildRecommendationsSystemPrompt(): string {
  return `You are a strategic prioritization advisor. A student has just plotted ideas on a 2×2 Impact/Effort matrix.

YOUR ROLE: Analyze their prioritization and provide actionable recommendations.

RULES:
- Identify the top 3 ideas from the "Quick Wins" quadrant (high impact, low effort)
- If fewer than 3 quick wins exist, recommend from "Major Projects" (high impact, high effort)
- Explain WHY these are worth pursuing based on their stated reasoning
- Note any ideas that might be misplaced (e.g., high-impact ideas in "Avoid" quadrant)
- Keep it action-oriented and specific to their context

RESPONSE FORMAT: Return JSON with:
{
  "recommendations": "2-3 sentences identifying top 3 ideas and why to pursue them. Include any placement concerns."
}`;
}

// ─── Main Handler ───

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { action, challenge, sessionId, idea, effortLevel, ideas } = body;

    // Rate limiting
    const rateLimitResult = rateLimit(sessionId, TOOLKIT_LIMITS);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)) } }
      );
    }

    let responseData: Record<string, unknown> = {};

    if (action === "nudge") {
      if (!idea || !effortLevel) {
        return NextResponse.json({ error: "Missing idea or effortLevel" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(effortLevel);
      const userPrompt = `The student is scoring this idea: "${idea}"

Challenge: ${challenge}

They rated it with provided impact and effort scores. Now they need to clarify their reasoning. Push them to think deeper about WHAT specifically impacts their goal and WHAT specifically requires effort.`;

      const aiResponse = await fetch("https://api.anthropic.com/v1/messages/create", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!aiResponse.ok) {
        console.error("[impact-effort] AI API error:", await aiResponse.text());
        return NextResponse.json({ nudge: "" }, { status: 200 });
      }

      const aiData = await aiResponse.json() as Record<string, unknown>;
      const aiContent = (aiData.content as Array<{ type: string; text?: string }>)?.[0]?.text || "";

      // Parse JSON from AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          responseData.nudge = parsed.nudge || "";
        } catch {
          responseData.nudge = "";
        }
      } else {
        responseData.nudge = "";
      }

      // Log usage
      logUsage({
        endpoint: "tools/impact-effort-matrix/nudge",
        model: "claude-haiku-4-5-20251001",
        inputTokens: 300,
        outputTokens: 150,
        metadata: { sessionId, action: "nudge" },
      });
    } else if (action === "recommendations") {
      if (!ideas || ideas.length === 0) {
        return NextResponse.json({ error: "Missing ideas" }, { status: 400 });
      }

      const systemPrompt = buildRecommendationsSystemPrompt();
      const ideasSummary = ideas
        .map((i, idx) => `${idx + 1}. "${i.text}" (Impact: ${i.impact}/5, Effort: ${i.effort}/5)`)
        .join("\n");

      const userPrompt = `Challenge: ${challenge}

Ideas plotted on matrix:
${ideasSummary}

Analyze this prioritization and recommend the top 3 ideas to pursue based on impact and effort. Also flag any ideas that might be misplaced.`;

      const aiResponse = await fetch("https://api.anthropic.com/v1/messages/create", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!aiResponse.ok) {
        console.error("[impact-effort] AI API error:", await aiResponse.text());
        return NextResponse.json({ recommendations: "" }, { status: 200 });
      }

      const aiData = await aiResponse.json() as Record<string, unknown>;
      const aiContent = (aiData.content as Array<{ type: string; text?: string }>)?.[0]?.text || "";

      // Parse JSON from AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          responseData.recommendations = parsed.recommendations || "";
        } catch {
          responseData.recommendations = "";
        }
      } else {
        responseData.recommendations = "";
      }

      // Log usage
      logUsage({
        endpoint: "tools/impact-effort-matrix/recommendations",
        model: "claude-haiku-4-5-20251001",
        inputTokens: 400,
        outputTokens: 200,
        metadata: { sessionId, action: "recommendations" },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[impact-effort] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
