// audit-skip: public anonymous free-tool, no actor identity
/**
 * Kanban Backlog Ideation tool.
 *
 * Helps a student populate their Project Board's Backlog without
 * doing their thinking for them. The AI never gives lists of cards —
 * only Socratic questions that point back at the student's own
 * project description and prior typed ideas. Effort-gated per
 * docs/education-ai-patterns.md (the student must always have done
 * thinking before the AI engages).
 *
 * Two actions:
 *   1. "probe"  — Generate 3-4 probe questions about the project.
 *                 Fired once after the student has typed a project
 *                 description AND 3 rough ideas of their own.
 *   2. "nudge"  — Effort-gated single follow-up after each idea the
 *                 student adds. References their typed idea, asks
 *                 them to dig one layer deeper. Never lists ideas.
 *
 * Uses Haiku 4.5 for speed + cost (this tool fires many small turns).
 */

import { NextRequest } from "next/server";
import {
  callHaiku,
  validateToolkitRequest,
  parseToolkitJSON,
  parseToolkitJSONArray,
  logToolkitUsage,
  toolkitErrorResponse,
} from "@/lib/toolkit";

// ─── System prompts ───────────────────────────────────────────────────────

function buildProbeSystemPrompt(): string {
  return `You are a design thinking mentor helping a student populate the Backlog of their Project Board for a long-running design unit. The student has just shared their project description and three rough ideas they've already considered.

YOUR ROLE: Generate exactly 4 probing questions that help the student think of MORE concrete, do-able backlog items — small chunks of work they could actually start on. Each question must reference something specific the student wrote (their project topic OR one of their 3 ideas).

HARD RULES:
- NEVER suggest backlog items yourself. NEVER write a list of ideas. NEVER say "you could try X, Y, Z."
- Questions only. The student must do the thinking — your job is to point them at angles they haven't considered.
- Each question should approach from a different angle: research, prototyping, materials, constraints, audience, scale, sequencing.
- Quote or paraphrase a specific phrase from what the student wrote so they know you read it.
- Use simple, clear language for ages 11-18. One question per item, max 22 words.

RESPONSE FORMAT: Return ONLY a JSON array of exactly 4 strings. No prose around it.
Example shape:
["You said X — what would the smallest first version of X look like?", "Your idea about Y assumes Z; what could you do to test if Z is true?", "...", "..."]`;
}

function buildNudgeSystemPrompt(
  effortLevel: "low" | "medium" | "high",
  ideaIndex: number
): string {
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's idea is brief or vague (e.g. "build prototype").
- DO NOT praise a vague idea — but stay warm.
- The "acknowledgment" MUST be an empty string.
- Push for concreteness: what kind of prototype? what materials? what step first?`,
    medium: `EFFORT LEVEL: MEDIUM — The student's idea has some substance.
- The "acknowledgment" should reference ONE specific word from their idea (3-7 words).
- Push them to break the idea down or sequence it: what comes first? what's the smallest version?`,
    high: `EFFORT LEVEL: HIGH — The student's idea is concrete and specific.
- The "acknowledgment" should celebrate the specificity (3-7 words).
- Push them to think about what comes BEFORE this card — is there prerequisite work?`,
  };

  const tempoNote =
    ideaIndex >= 4
      ? `\nThe student already has ${ideaIndex + 1} ideas typed. Your nudge should very gently signal they could stop soon — but only if they want to. Phrase it as a question, not a directive.`
      : "";

  return `You are an encouraging design thinking mentor. The student is using a Backlog Ideation tool: they typed a project description, three rough first ideas, then are now typing more concrete backlog items one at a time. They just typed a new idea.

${effortStrategy[effortLevel]}${tempoNote}

YOUR ROLE: Return a JSON object with feedback that helps them go ONE layer deeper on this card OR see what should come before/after it.

HARD RULES:
- "acknowledgment": empty string for low effort; otherwise a 3-7 word note quoting/paraphrasing one phrase from their idea.
- "nudge": ONE follow-up question, max 25 words. Always references their typed idea.
- NEVER suggest a backlog item. NEVER list options. Question only.
- Use simple, clear language for ages 11-18.

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Good — 'sketch three views' is concrete!", "nudge": "What single sketch would tell you the most about whether the wheel idea is feasible?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you make 'build prototype' more specific — what part of the prototype, with what material?"}`;
}

// ─── POST handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "kanban-ideation", [
    "probe",
    "nudge",
  ]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;
  // `challenge` is the project description (validateToolkitRequest names
  // it "challenge" because it was originally built for design-thinking
  // tools where the input is "the design challenge"). For this tool it's
  // the project description.
  const projectDescription = challenge;

  try {
    /* ─── Action: Generate probe questions ─── */
    if (action === "probe") {
      const studentIdeas = (body.studentIdeas || []) as string[];
      if (studentIdeas.length < 3) {
        return Response.json(
          {
            error:
              "Tell me three rough ideas of your own first — even very rough is fine.",
          },
          { status: 400 }
        );
      }

      const userPrompt = `Project description: "${projectDescription}"

The student's three rough first ideas:
${studentIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Generate 4 probing questions to help them think of more concrete backlog items.`;

      const result = await callHaiku(
        buildProbeSystemPrompt(),
        userPrompt,
        350
      );

      const prompts = parseToolkitJSONArray(result.text) || [
        "What would the smallest first version of your project look like?",
        "What's the first thing you'd need to research?",
        "What materials or tools do you need to find or make?",
        "Which of your three ideas could you start on today?",
      ];

      logToolkitUsage("tools/kanban-ideation/probe", result, {
        sessionId,
        action: "probe",
      });
      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Effort-gated nudge after a typed idea ─── */
    if (action === "nudge") {
      const idea = body.idea as string | undefined;
      const effortLevel =
        (body.effortLevel as "low" | "medium" | "high") || "medium";
      const ideaIndex = (body.ideaIndex as number) ?? 0;
      const allIdeas = ((body as { priorIdeas?: string[] }).priorIdeas ||
        []) as string[];

      if (!idea?.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const userPrompt = `Project description: "${projectDescription}"
${allIdeas.length > 0 ? `Their typed ideas so far:\n${allIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : ""}

The student just typed this new idea: "${idea}"

Respond with JSON feedback that helps them go one layer deeper.`;

      const result = await callHaiku(
        buildNudgeSystemPrompt(effortLevel, ideaIndex),
        userPrompt,
        140
      );
      const parsed = parseToolkitJSON(result.text, {
        acknowledgment: "",
        nudge: result.text.trim(),
      });

      logToolkitUsage("tools/kanban-ideation/nudge", result, {
        sessionId,
        action: "nudge",
        effortLevel,
        ideaIndex,
      });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("kanban-ideation", err);
  }
}
