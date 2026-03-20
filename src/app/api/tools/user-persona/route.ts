/**
 * User Persona Toolkit AI API
 *
 * 5 sections: Demographics, Goals, Frustrations, Day in Life, Quote
 * Builds a realistic, empathetic user persona.
 *
 * Two interaction modes:
 *   1. "nudge"        — Section-specific writing coach
 *   2. "implications" — Design implications synthesis
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

const SECTIONS = [
  { key: "demographics", name: "Demographics", focus: "age, job, location, family, specifics" },
  { key: "goals", name: "Goals & Motivations", focus: "underlying wants, what matters" },
  { key: "frustrations", name: "Frustrations & Pain Points", focus: "workarounds, givens-up, anger points" },
  { key: "daylife", name: "A Day in Their Life", focus: "routine, timing, context, where design fits" },
  { key: "quote", name: "Quote", focus: "one sentence capturing essence" },
];

type ActionType = "nudge" | "implications";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  section?: string;
  currentText?: string;
  allSections?: Record<string, string>;
}

// ─── Section-Specific Nudge ───

function buildNudgeSystemPrompt(sectionName: string): string {
  return `You are a UX researcher and writing coach helping someone create a realistic user persona.

The user is working on the "${sectionName}" section.

Your role: Give a brief, specific nudge (1-2 sentences) that pushes them toward authenticity and specificity.

For Demographics: "Be specific, not generic. A real person with a real life."
For Goals: "Dig deeper than surface goals. What's the underlying motivation?"
For Frustrations: "What workarounds do they use? What have they given up on?"
For Day in Life: "Walk through a realistic day with specific times and context."
For Quote: "Make it sound like them — authentic, conversational, revealing."

Don't praise. Just probe.`;
}

function buildNudgeUserPrompt(sectionName: string, currentText: string, challenge: string): string {
  const allText = currentText || "(no input yet)";

  return `The user is building a persona for: "${challenge}"

In the "${sectionName}" section, they've written: "${allText}"

Give a 1-sentence nudge that pushes for more specificity, authenticity, or depth.`;
}

async function generateNudge(sectionName: string, currentText: string, challenge: string): Promise<string> {
  const anthropic = require("@anthropic-ai/sdk");
  const client = new anthropic.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildNudgeSystemPrompt(sectionName);
  const userPrompt = buildNudgeUserPrompt(sectionName, currentText, challenge);

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
    return "Tell me more about this person.";
  } catch {
    return "Tell me more about this person.";
  }
}

// ─── Design Implications ───

function buildImplicationsSystemPrompt(): string {
  return `You are a product designer synthesizing a user persona into design implications.

You have a complete persona (Demographics, Goals, Frustrations, Day in Life, Quote).

Your job: identify 3 concrete design implications.

Write 3 short sentences. Each should start with:
- "This person needs..."
- "They'll get stuck if..."
- "Success means..."

Be specific and reference actual details from the persona.`;
}

function buildImplicationsUserPrompt(challenge: string, allSections: Record<string, string>): string {
  const sectionTexts = SECTIONS.map((s) => `**${s.name}:** ${allSections[s.key] || "(empty)"}`)
    .join("\n\n");

  return `Designing for: "${challenge}"

Persona:
${sectionTexts}

What are 3 concrete design implications for this persona?`;
}

async function generateImplications(challenge: string, allSections: Record<string, string>): Promise<string> {
  const anthropic = require("@anthropic-ai/sdk");
  const client = new anthropic.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildImplicationsSystemPrompt();
  const userPrompt = buildImplicationsUserPrompt(challenge, allSections);

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
    return "Review your persona and consider its design implications.";
  } catch {
    return "Review your persona and consider its design implications.";
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
    const { action, challenge, sessionId, section = "", currentText = "", allSections = {} } = body;

    if (action === "nudge") {
      const nudgeText = await generateNudge(section, currentText, challenge);

      await logUsage(sessionId, "user-persona", "nudge", "claude-haiku-4-5-20251001", 100, 50);

      return NextResponse.json({
        success: true,
        nudge: nudgeText,
      });
    }

    if (action === "implications") {
      const implicationsText = await generateImplications(challenge, allSections);

      await logUsage(sessionId, "user-persona", "implications", "claude-haiku-4-5-20251001", 300, 150);

      return NextResponse.json({
        success: true,
        implications: implicationsText,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("User Persona API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
