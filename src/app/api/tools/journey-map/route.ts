/**
 * Journey Map Toolkit AI API
 *
 * 5 phases: Before, Arrival, During, After, Emotions
 * Each phase maps a user's experience through time.
 *
 * Three interaction modes:
 *   1. "nudge"    — Context-aware prompts per phase
 *   2. "insights" — Pain points and opportunities synthesis
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

const PHASES = [
  { name: "Before", focus: "discovery, awareness, triggers" },
  { name: "Arrival", focus: "first impression, initial setup" },
  { name: "During", focus: "core experience, key touchpoints" },
  { name: "After", focus: "reflection, recollection, recommendation" },
  { name: "Emotions", focus: "emotional peaks and valleys" },
];

type ActionType = "nudge" | "insights";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  stepIndex?: number;
  idea?: string;
  existingIdeas?: string[];
  phase?: string;
  allIdeas?: string[][];
  persona?: string;
}

// ─── Phase-Specific Nudge ───

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

Existing ideas in this phase: ${existingIdeas.length > 0 ? existingIdeas.map((i) => `"${i}"`).join(", ") : "none yet"}

Give a 1-sentence nudge that probes deeper into what they've written.`;
}

async function generateNudge(
  phaseIndex: number,
  currentText: string,
  existingIdeas: string[],
  challenge: string,
  persona: string
): Promise<string> {
  const anthropic = require("@anthropic-ai/sdk");
  const client = new anthropic.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildNudgeSystemPrompt(phaseIndex);
  const userPrompt = buildNudgeUserPrompt(phaseIndex, currentText, existingIdeas, challenge, persona);

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = msg.content[0];
    if (content.type === "text") {
      return content.text.trim();
    }
    return "What else can you add?";
  } catch {
    return "Tell me more about this phase.";
  }
}

// ─── Insights Synthesis ───

function buildInsightsSystemPrompt(): string {
  return `You are a UX researcher synthesizing a user journey map into actionable insights.

You have 5 phases of a journey map (Before, Arrival, During, After, Emotions) filled with user observations.

Synthesize these into:
1. **Key pain points** — where is the user stuck, frustrated, or losing motivation?
2. **Emotional peaks and valleys** — where are the high-energy moments vs drains?
3. **Opportunities** — where could you intervene to add delight or remove friction?

Write 2-3 short sentences per category (max 5 sentences total). Be specific, reference the details.`;
}

function buildInsightsUserPrompt(challenge: string, allIdeas: string[][], persona: string): string {
  const phases = ["Before", "Arrival", "During", "After", "Emotions"];
  const phaseTexts = phases
    .map((name, idx) => {
      const ideas = allIdeas[idx] || [];
      return `${name}: ${ideas.length > 0 ? ideas.join(" | ") : "(empty)"}`;
    })
    .join("\n");

  return `Journey being mapped: "${challenge}"
Persona: "${persona}"

Journey phases:
${phaseTexts}

Synthesize the pain points, emotional arc, and top 3 design opportunities.`;
}

async function generateInsights(
  challenge: string,
  allIdeas: string[][],
  persona: string
): Promise<string> {
  const anthropic = require("@anthropic-ai/sdk");
  const client = new anthropic.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildInsightsSystemPrompt();
  const userPrompt = buildInsightsUserPrompt(challenge, allIdeas, persona);

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = msg.content[0];
    if (content.type === "text") {
      return content.text.trim();
    }
    return "Review your journey map for patterns and opportunities.";
  } catch {
    return "Review your journey map for patterns and opportunities.";
  }
}

// ─── Main Handler ───

export async function POST(req: NextRequest) {
  try {
    const limitStatus = await rateLimit(req, TOOLKIT_LIMITS);
    if (!limitStatus.allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const body: RequestBody = await req.json();
    const { action, challenge, sessionId, stepIndex = 0, idea = "", existingIdeas = [], allIdeas = [], phase = "", persona = "" } = body;

    if (action === "nudge") {
      const nudgeText = await generateNudge(stepIndex, idea, existingIdeas, challenge, persona);

      await logUsage(sessionId, "journey-map", "nudge", "claude-haiku-4-5-20251001", 100, 50);

      return NextResponse.json({
        success: true,
        nudge: nudgeText,
      });
    }

    if (action === "insights") {
      const insightsText = await generateInsights(challenge, allIdeas, persona);

      await logUsage(sessionId, "journey-map", "insights", "claude-haiku-4-5-20251001", 300, 150);

      return NextResponse.json({
        success: true,
        insights: insightsText,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Journey Map API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
