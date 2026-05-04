// audit-skip: public anonymous free-tool, no actor identity
/**
 * Systems Map Toolkit AI API
 *
 * 3 steps: Elements, Connections, Feedback Loops
 * Maps the ecosystem and identifies systemic leverage points.
 *
 * Two interaction modes:
 *   1. "nudge"    — Step-specific prompts
 *   2. "insights" — Identifies key leverage points
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

const STEPS = [
  { name: "Elements", focus: "parts, actors, rules, infrastructure" },
  { name: "Connections", focus: "relationships, flows, influences" },
  { name: "Feedback Loops", focus: "circular patterns, reinforcing loops, leverage points" },
];

// ─── Tool-specific prompt builders ───

function buildNudgeSystemPrompt(stepIndex: number): string {
  const step = STEPS[stepIndex];
  return `You are a systems thinking coach helping someone map an ecosystem.

The user is working on the "${step.name}" step, which focuses on: ${step.focus}.

Provide a brief nudge (1-2 sentences max) that encourages deeper systemic thinking.
- For Elements: push on hidden actors (regulations, culture, supply chains)
- For Connections: push on specificity (not just "affects" but how and why)
- For Feedback Loops: push on circular causality (where does it loop back?)

Be Socratic — probe without praising.`;
}

function buildNudgeUserPrompt(
  stepIndex: number,
  currentText: string,
  existingIdeas: string[],
  challenge: string
): string {
  const step = STEPS[stepIndex];
  const allText = currentText || "(no input yet)";

  return `The user is analyzing system: "${challenge}"

In the "${step.name}" step, they've written: "${allText}"

Existing ${step.name.toLowerCase()} in this map: ${existingIdeas.length > 0 ? existingIdeas.map((i: string) => `"${i}"`).join(", ") : "none yet"}

Give a 1-sentence nudge that probes deeper into systems thinking.`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a systems thinking mentor synthesizing a systems map into strategic insights.

The student has mapped a system across 3 steps: Elements, Connections, and Feedback Loops.

YOUR ROLE: Help them see leverage points — where small changes create big effects.

RULES:
- Identify the most important elements (the few actors/factors that matter most)
- Trace the key connections and influences (what drives what?)
- Identify leverage points (where a small change could create systemic shift)
- Ask 1-2 questions about which leverage point has the most potential
- Keep the response under 150 words
- Use simple, clear language for ages 11-18
- Reference specific elements and connections from their map

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "systems-map", ["nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Step-specific nudge ─── */
    if (action === "nudge") {
      const { stepIndex = 0, currentText = "", existingIdeas = [] } = body;
      if (stepIndex < 0 || stepIndex >= STEPS.length) {
        return Response.json({ error: "Invalid step index" }, { status: 400 });
      }

      const userPrompt = buildNudgeUserPrompt(
        stepIndex as number,
        currentText as string,
        existingIdeas as string[],
        challenge
      );

      const result = await callHaiku(buildNudgeSystemPrompt(stepIndex as number), userPrompt, 150);

      logToolkitUsage("tools/systems-map/nudge", result, {
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

      const ideaSummary = STEPS.map((step, i) => {
        const ideas = (allIdeas as string[][])[i] || [];
        return `${step.name}: ${ideas.length > 0 ? ideas.map((idea) => `"${idea}"`).join(", ") : "(empty)"}`;
      }).join("\n");

      const userPrompt = `System: "${challenge}"

Systems Map Across All Steps:
${ideaSummary}

Analyze this systems map for leverage points and strategic insights.`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 300);

      logToolkitUsage("tools/systems-map/insights", result, {
        sessionId,
        action: "insights",
      });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("systems-map", err);
  }
}
