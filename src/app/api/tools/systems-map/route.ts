/**
 * Systems Map Toolkit AI API
 *
 * 3 steps: Elements, Connections, Feedback Loops
 * Maps the ecosystem and identifies systemic leverage points.
 *
 * Three interaction modes:
 *   1. "nudge"    — Step-specific prompts
 *   2. "insights" — Identifies key leverage points
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

const STEPS = [
  { name: "Elements", focus: "parts, actors, rules, infrastructure" },
  { name: "Connections", focus: "relationships, flows, influences" },
  { name: "Feedback Loops", focus: "circular patterns, reinforcing loops, leverage points" },
];

type ActionType = "nudge" | "insights";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  stepIndex?: number;
  idea?: string;
  existingIdeas?: string[];
  step?: string;
  allIdeas?: string[][];
}

// ─── Step-Specific Nudge ───

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

Existing ${step.name.toLowerCase()} in this map: ${existingIdeas.length > 0 ? existingIdeas.map((i) => `"${i}"`).join(", ") : "none yet"}

Give a 1-sentence nudge that probes deeper into systems thinking.`;
}

async function generateNudge(
  stepIndex: number,
  currentText: string,
  existingIdeas: string[],
  challenge: string
): Promise<string> {
  const anthropic = require("@anthropic-ai/sdk");
  const client = new anthropic.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildNudgeSystemPrompt(stepIndex);
  const userPrompt = buildNudgeUserPrompt(stepIndex, currentText, existingIdeas, challenge);

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
    return "Think about what else is part of this system.";
  } catch {
    return "Tell me more about this part of the system.";
  }
}

// ─── Insights Synthesis ───

function buildInsightsSystemPrompt(): string {
  return `You are a systems analyst identifying leverage points in a mapped ecosystem.

You have 3 steps of a systems map:
1. Elements — all the parts and actors
2. Connections — relationships between them
3. Feedback Loops — circular patterns

Your job: identify the most influential element and the strongest feedback loop.

Write 3-4 short sentences. Be specific. Reference actual elements and connections from the map.`;
}

function buildInsightsUserPrompt(challenge: string, allIdeas: string[][]): string {
  const steps = ["Elements", "Connections", "Feedback Loops"];
  const stepTexts = steps
    .map((name, idx) => {
      const ideas = allIdeas[idx] || [];
      return `${name}: ${ideas.length > 0 ? ideas.join(" | ") : "(empty)"}`;
    })
    .join("\n");

  return `System being mapped: "${challenge}"

Map so far:
${stepTexts}

Identify:
1. The most influential element in this system
2. The strongest feedback loop (where change cascades)
3. Where you could intervene to shift the whole system`;
}

async function generateInsights(challenge: string, allIdeas: string[][]): Promise<string> {
  const anthropic = require("@anthropic-ai/sdk");
  const client = new anthropic.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildInsightsSystemPrompt();
  const userPrompt = buildInsightsUserPrompt(challenge, allIdeas);

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
    return "Review your systems map for leverage points.";
  } catch {
    return "Review your systems map for leverage points.";
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
    const { action, challenge, sessionId, stepIndex = 0, idea = "", existingIdeas = [], allIdeas = [], step = "" } = body;

    if (action === "nudge") {
      const nudgeText = await generateNudge(stepIndex, idea, existingIdeas, challenge);

      await logUsage(sessionId, "systems-map", "nudge", "claude-haiku-4-5-20251001", 100, 50);

      return NextResponse.json({
        success: true,
        nudge: nudgeText,
      });
    }

    if (action === "insights") {
      const insightsText = await generateInsights(challenge, allIdeas);

      await logUsage(sessionId, "systems-map", "insights", "claude-haiku-4-5-20251001", 300, 150);

      return NextResponse.json({
        success: true,
        insights: insightsText,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Systems Map API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
