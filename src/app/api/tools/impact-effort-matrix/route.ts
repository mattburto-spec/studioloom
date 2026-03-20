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

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "impact-effort-matrix", ["nudge", "recommendations"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Nudge feedback ─── */
    if (action === "nudge") {
      const { effortLevel = "medium", impactReasoning = "", effortReasoning = "" } = body;

      const userPrompt = `Challenge: "${challenge}"

Impact Reasoning: "${impactReasoning}"
Effort Reasoning: "${effortReasoning}"

Provide feedback on the quality and clarity of this reasoning.`;

      const result = await callHaiku(
        buildNudgeSystemPrompt(effortLevel as "low" | "medium" | "high"),
        userPrompt,
        120
      );
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/impact-effort-matrix/nudge", result, {
        sessionId,
        effortLevel,
        action: "nudge",
      });

      return Response.json({
        acknowledgment: parsed.acknowledgment || "",
        nudge: parsed.nudge || result.text.trim(),
        effortLevel,
      });
    }

    /* ─── Action: Recommendations synthesis ─── */
    if (action === "recommendations") {
      const { ideas = [] } = body;
      if (!Array.isArray(ideas) || ideas.length === 0) {
        return Response.json({ recommendations: "" });
      }

      const ideaList = (ideas as Array<{ text: string; impact?: number; effort?: number }>)
        .map((idea) => {
          const impact = idea.impact || 0;
          const effort = idea.effort || 0;
          const quadrant =
            impact >= 3 && effort <= 2
              ? "Quick Wins"
              : impact >= 3 && effort > 2
                ? "Major Projects"
                : impact < 3 && effort <= 2
                  ? "Low Priority"
                  : "Avoid";
          return `- "${idea.text}" (Impact: ${impact}, Effort: ${effort}) → ${quadrant}`;
        })
        .join("\n");

      const userPrompt = `Challenge: "${challenge}"

Ideas plotted on Impact/Effort matrix:
${ideaList}

Analyze this prioritization and recommend the top 3 ideas to pursue.`;

      const result = await callHaiku(buildRecommendationsSystemPrompt(), userPrompt, 200);
      const parsed = parseToolkitJSON(result.text, { recommendations: result.text.trim() });

      logToolkitUsage("tools/impact-effort-matrix/recommendations", result, {
        sessionId,
        ideaCount: ideas.length,
        action: "recommendations",
      });

      return Response.json({
        recommendations: parsed.recommendations || result.text.trim(),
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("impact-effort-matrix", err);
  }
}
