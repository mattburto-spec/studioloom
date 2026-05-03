// audit-skip: public anonymous free-tool, no actor identity
/**
 * User Persona Toolkit AI API
 *
 * 5 sections: Demographics, Goals, Frustrations, Day in Life, Quote
 * Builds a realistic, empathetic user persona.
 *
 * Two interaction modes:
 *   1. "nudge"        — Section-specific writing coach
 *   2. "implications" — Design implications synthesis
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

// ─── Tool-specific config ───

const SECTIONS = [
  { key: "demographics", name: "Demographics", focus: "age, job, location, family, specifics" },
  { key: "goals", name: "Goals & Motivations", focus: "underlying wants, what matters" },
  { key: "frustrations", name: "Frustrations & Pain Points", focus: "workarounds, givens-up, anger points" },
  { key: "daylife", name: "A Day in Their Life", focus: "routine, timing, context, where design fits" },
  { key: "quote", name: "Quote", focus: "one sentence capturing essence" },
];

// ─── Tool-specific prompt builders ───

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

function buildImplicationsSystemPrompt(): string {
  return `You are a product designer synthesizing a user persona into design implications.

You have a complete persona (Demographics, Goals, Frustrations, Day in Life, Quote).

YOUR ROLE: Identify the top 3 design implications — specific, actionable insights about what to build.

RULES:
- Each implication should flow from a specific persona insight
- Implications should be about FEATURES or EXPERIENCES, not abstract principles
- Reference specific persona details to justify each implication
- Prioritize by impact (what would matter most to this person?)
- Keep each implication to 1-2 sentences max
- Use clear, accessible language for ages 11-18

RESPONSE FORMAT: Return JSON with:
{
  "implications": "1. [First implication based on specific persona detail]\n2. [Second implication]\n3. [Third implication]"
}`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "user-persona", ["nudge", "implications"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Section-specific nudge ─── */
    if (action === "nudge") {
      const { section = "", currentText = "" } = body;
      if (!section) {
        return Response.json({ error: "Missing section" }, { status: 400 });
      }

      const userPrompt = buildNudgeUserPrompt(section as string, currentText as string, challenge);

      const result = await callHaiku(buildNudgeSystemPrompt(section as string), userPrompt, 150);

      logToolkitUsage("tools/user-persona/nudge", result, {
        sessionId,
        section,
        action: "nudge",
      });

      return Response.json({ nudge: result.text.trim() });
    }

    /* ─── Action: Design implications synthesis ─── */
    if (action === "implications") {
      const allSections = (body.allSections || {}) as Record<string, string>;
      const hasContent = Object.values(allSections).some(
        (section) => typeof section === "string" && section.trim().length > 0
      );
      if (!hasContent) {
        return Response.json({ implications: "" });
      }

      const sectionSummary = SECTIONS.map((section) => {
        const content = allSections[section.key] || "(not filled)";
        return `${section.name}: ${content}`;
      }).join("\n\n");

      const userPrompt = `Persona for: "${challenge}"

${sectionSummary}

What are the top 3 design implications based on this persona?`;

      const result = await callHaiku(buildImplicationsSystemPrompt(), userPrompt, 300);
      const parsed = parseToolkitJSON(result.text, { implications: result.text.trim() });

      logToolkitUsage("tools/user-persona/implications", result, {
        sessionId,
        action: "implications",
      });

      return Response.json({
        implications: parsed.implications || result.text.trim(),
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("user-persona", err);
  }
}
