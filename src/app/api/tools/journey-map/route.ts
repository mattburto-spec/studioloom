/**
 * Journey Map Toolkit AI API
 *
 * 5 phases: Before, Arrival, During, After, Emotions
 * Each phase maps a user's experience through time.
 *
 * Two interaction modes:
 *   1. "nudge"    — Context-aware prompts per phase
 *   2. "insights" — Pain points and opportunities synthesis
 *
 * Uses shared toolkit helpers — see src/lib/toolkit/shared-api.ts
 */

import { NextRequest } from "next/server";
import {
  callHaiku,
  validateToolkitRequest,
  logToolkitUsage,
  toolkitErrorResponse,
} from "@/lib/toolkit";

// ─── Tool-specific config ───

const PHASES = [
  { name: "Before", focus: "discovery, awareness, triggers" },
  { name: "Arrival", focus: "first impression, initial setup" },
  { name: "During", focus: "core experience, key touchpoints" },
  { name: "After", focus: "reflection, recollection, recommendation" },
  { name: "Emotions", focus: "emotional peaks and valleys" },
];

// ─── Tool-specific prompt builders ───

function buildNudgeSystemPrompt(phaseIndex: number): string {
  const phase = PHASES[phaseIndex];
  return `You are a UX research coach helping someone map a user's experience journey.

The user is working on the "${phase.name}" phase of the journey, which focuses on: ${phase.focus}.

Provide a brief, specific nudge (1-2 sentences max) that encourages deeper thinking about this phase.
- For Before: push on discovery triggers and awareness
- For Arrival: push on first impressions and emotional reaction
- For During: push on specific touchpoints and moments
- For After: push on memory and likelihood to recommend
- For Emotions: push on contradictory or nuanced feelings

Be direct and Socratic — don't praise, just probe.`;
}

function buildNudgeUserPrompt(
  phaseIndex: number,
  currentText: string,
  existingIdeas: string[],
  challenge: string,
  persona: string
): string {
  const phase = PHASES[phaseIndex];
  const allText = currentText || "(no input yet)";

  return `The user is mapping: "${challenge}"
For persona: "${persona}"

In the "${phase.name}" phase, they've written: "${allText}"

Existing ideas in this phase: ${existingIdeas.length > 0 ? existingIdeas.map((i: string) => `"${i}"`).join(", ") : "none yet"}

Give a 1-sentence nudge that probes deeper into what they've written.`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a UX research mentor synthesizing a journey map into insights.

The student has mapped a user's experience across 5 phases: Before, Arrival, During, After, Emotions.

YOUR ROLE: Help them see patterns and identify the biggest pain points and opportunities.

RULES:
- Identify 2-3 key pain points (where does the user struggle or feel frustrated?)
- Identify 2-3 opportunities (where could the design improve the experience?)
- Reference specific phases and touchpoints from their map
- Ask 1-2 questions about which pain point has the most impact
- Keep the response under 150 words
- Use simple, clear language for ages 11-18

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "journey-map", ["nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Phase-specific nudge ─── */
    if (action === "nudge") {
      const { stepIndex = 0, currentText = "", existingIdeas = [], persona = "User" } = body;
      if (stepIndex < 0 || stepIndex >= PHASES.length) {
        return Response.json({ error: "Invalid phase index" }, { status: 400 });
      }

      const userPrompt = buildNudgeUserPrompt(
        stepIndex as number,
        currentText as string,
        existingIdeas as string[],
        challenge,
        persona as string
      );

      const result = await callHaiku(buildNudgeSystemPrompt(stepIndex as number), userPrompt, 150);

      logToolkitUsage("tools/journey-map/nudge", result, {
        sessionId,
        stepIndex,
        action: "nudge",
      });

      return Response.json({ nudge: result.text.trim() });
    }

    /* ─── Action: Insights synthesis ─── */
    if (action === "insights") {
      const { allIdeas = [] } = body;
      const hasIdeas = (allIdeas as string[][]).some((arr) => Array.isArray(arr) && arr.length > 0);
      if (!hasIdeas) {
        return Response.json({ insights: "" });
      }

      const ideaSummary = PHASES.map((phase, i) => {
        const ideas = (allIdeas as string[][])[i] || [];
        return `${phase.name}: ${ideas.length > 0 ? ideas.map((idea) => `"${idea}"`).join(", ") : "(empty)"}`;
      }).join("\n");

      const userPrompt = `User Journey: "${challenge}"

Journey Map Across All Phases:
${ideaSummary}

Analyze this journey map for pain points and opportunities.`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 300);

      logToolkitUsage("tools/journey-map/insights", result, {
        sessionId,
        action: "insights",
      });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("journey-map", err);
  }
}
