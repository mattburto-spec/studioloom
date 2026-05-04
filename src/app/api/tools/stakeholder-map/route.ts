// audit-skip: public anonymous free-tool, no actor identity
/**
 * Stakeholder Map Toolkit AI API
 *
 * Three-step research tool for mapping all stakeholders affected by a design:
 *   1. "prompts"  — Generate questions for brainstorming stakeholders
 *   2. "nudge"    — Effort-gated Socratic feedback per step
 *   3. "insights" — Synthesis across all stakeholders and their needs
 *
 * RESEARCH PHASE: encourage depth and specificity — follow-ups, edge cases, validating assumptions.
 * This tool helps students think beyond obvious users to indirect beneficiaries, blockers, and opponents.
 *
 * Uses shared toolkit helpers — see src/lib/toolkit/shared-api.ts
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

// ─── Tool-specific prompt builders ───

function buildPromptsSystemPrompt(stepIndex: number, ideaCount: number): string {
  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written any ideas yet for this step.
- Start with accessible, concrete questions that connect to everyday experience
- First question should be the easiest entry point possible
- Gradually increase complexity across the 4 questions
- Use tangible examples`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} idea(s). Push in new directions.
- Avoid angles the student has already explored
- Questions should push toward less obvious stakeholders and implications
- Mix different approaches`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} ideas. Push into unexplored territory.
- These prompts should surface hidden or non-obvious stakeholders
- Go for unexpected angles — indirect beneficiaries, future users, competitors, regulators`;
  }

  const stepRules =
    stepIndex === 0
      ? `STEP 1 — "List All Stakeholders":
- This is EXPLORATORY research. Encourage comprehensive thinking.
- Push students to think BEYOND the obvious primary users.
- Who else is affected? Directly, indirectly, intentionally, unintentionally?
- Who benefits? Who loses? Who might resist? Who has power over the outcome?
- Examples: families, competitors, vendors, regulators, investors, future users, people who lose jobs`
      : stepIndex === 1
      ? `STEP 2 — "Categorize by Influence & Interest":
- This is ANALYTICAL. Help students see which stakeholders matter most.
- High influence + high interest = KEY PLAYERS. Need to satisfy these.
- High influence + low interest = KEEP SATISFIED.
- Low influence + high interest = KEEP INFORMED.
- Low influence + low interest = MONITOR.`
      : `STEP 3 — "Understand Their Needs":
- This is EMPATHY-FOCUSED research. Help students see from each stakeholder's perspective.
- What does this specific stakeholder need to be happy with the solution?
- What are they worried about? What could go wrong FOR THEM?
- What would earn their trust or support?`;

  return `You are a design thinking mentor helping a student map stakeholders for a design project.

${stepRules}

${difficultyInstruction}

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the student's design challenge.

RULES:
- Questions MUST reference specific aspects of their actual challenge
- Never suggest specific stakeholders — only ask questions that unlock thinking
- Each question should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings, each a question. Nothing else.`;
}

function buildNudgeSystemPrompt(stepIndex: number, effortLevel: "low" | "medium" | "high"): string {
  const phaseStrategy = `THIS IS RESEARCH — your job is to help the student think deeply and comprehensively about stakeholders and their needs.
Push for specificity, edge cases, and perspectives they might have missed.
Never give them the answer — only ask questions that unlock deeper thinking.`;

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague. Encourage them to flesh it out.
- Do NOT praise a vague idea — but stay warm and encouraging
- Ask them to be more specific: who exactly, what would happen, what would they need?
- Nudge for specifics that EXPAND the understanding
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Deepen their analysis.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Push them to consider related stakeholders or implications they missed
- Ask "who else might be affected by that?" or "what would that stakeholder worry about?"`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and thoughtful. Push for insights.
- The "acknowledgment" should celebrate a SPECIFIC detail from their thinking (3-8 words)
- Push for second-order effects, trade-offs, or ethical considerations
- Ask "how could we make sure this stakeholder feels heard?" or "what's the risk if we ignore this person?"`,
  };

  return `You are an encouraging design thinking mentor. A student just added an idea to their Stakeholder Map.

${phaseStrategy}

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive and curious.

RULES:
- "acknowledgment": 3-8 word note referencing their specific idea (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- Reference their specific idea — don't be generic
- Vary your approach — try "who else", "what if", "how would", "what would they"

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Good thinking about indirect users!", "nudge": "Who else indirectly uses or is affected by this that you haven't mentioned?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you describe specifically who that is and what they do or need?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete Stakeholder Map.

They have:
1. Listed all stakeholders affected by their design
2. Categorized them by influence and interest (high/low × high/low)
3. Documented what key stakeholders need

YOUR ROLE: Help them see the big picture — patterns, tensions, and strategic implications.

RULES:
- Identify 2-3 key groups or clusters of stakeholders and what they have in common
- Highlight who are the "critical" stakeholders (high influence + high interest)
- Point out any surprising stakeholders or needs they've identified
- Note any potential conflicts: stakeholder groups with opposite needs
- Ask 1 provocative question about how to design for competing stakeholder needs
- Be encouraging but honest — if analysis is surface-level, gently push for depth
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC stakeholders and needs from their map

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "stakeholder-map", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const stepIndex = (body.stepIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];

      if (stepIndex < 0 || stepIndex > 2) {
        return Response.json({ error: "stepIndex must be 0-2" }, { status: 400 });
      }

      const systemPrompt = buildPromptsSystemPrompt(stepIndex, existingIdeas.length);

      const stepNames = ["all stakeholders", "influence and interest categories", "stakeholder needs"];
      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

CURRENT STEP: ${stepIndex + 1} - ${stepNames[stepIndex]}`;

      if (existingIdeas.length > 0) {
        userPrompt += `\n\nIDEAS ALREADY GENERATED:\n${existingIdeas
          .map((idea, i) => `${i + 1}. ${idea}`)
          .join("\n")}

Generate 4 NEW questions that push the student in DIFFERENT directions from their existing ideas.`;
      } else {
        userPrompt += `\n\nGenerate 4 thought-provoking questions specific to this challenge and this step.`;
      }

      const result = await callHaiku(systemPrompt, userPrompt, 400);

      const prompts = parseToolkitJSONArray(result.text) || [
        stepIndex === 0
          ? "Who directly or indirectly uses or is affected by this design?"
          : stepIndex === 1
          ? "Which stakeholders have the most power to make or block this idea?"
          : "What does each stakeholder specifically need to be happy with this?",
        stepIndex === 0
          ? "Who might resist this design, and why?"
          : stepIndex === 1
          ? "Who cares the most about the outcome?"
          : "What are they worried about or what could go wrong for them?",
        stepIndex === 0
          ? "Who profits or loses depending on how this turns out?"
          : stepIndex === 1
          ? "Who has both power and care — those are your key players?"
          : "How would you earn each stakeholder's trust?",
        stepIndex === 0
          ? "What future users or markets might this affect?"
          : stepIndex === 1
          ? "Who do you need to convince first?"
          : "What trade-offs or compromises might you need to make?",
      ];

      logToolkitUsage("tools/stakeholder-map/prompts", result, { sessionId, stepIndex, action: "prompts" });

      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Effort-gated nudge ─── */
    if (action === "nudge") {
      const idea = (body.idea as string) ?? "";
      const stepIndex = (body.stepIndex as number) ?? 0;
      const clientEffort = (body.effortLevel as "low" | "medium" | "high") ?? "medium";
      const existingIdeas = (body.existingIdeas || []) as string[];

      if (!idea.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(stepIndex, clientEffort);

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"
CURRENT STEP: ${stepIndex === 0 ? "List All Stakeholders" : stepIndex === 1 ? "Categorize by Influence & Interest" : "Understand Their Needs"}
IDEA JUST ADDED: "${idea.trim()}"`;

      if (existingIdeas.length > 1) {
        userPrompt += `\nOTHER IDEAS IN THIS STEP: ${existingIdeas.filter(i => i !== idea.trim()).join("; ")}`;
      }

      userPrompt += `\n\nReturn a JSON object with your acknowledgment and follow-up question.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/stakeholder-map/nudge", result, { sessionId, stepIndex, action: "nudge", effortLevel: clientEffort });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel: clientEffort,
      });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const allStakeholders = (body.allStakeholders || []) as string[];
      const categorized = (body.categorized || {}) as Record<string, string[]>;
      const needs = (body.needs || {}) as Record<string, string>;

      if (!allStakeholders || allStakeholders.length === 0) {
        return Response.json({ insights: "" });
      }

      const ideaSummary = `ALL STAKEHOLDERS (${allStakeholders.length} total):
${allStakeholders.length > 0 ? allStakeholders.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(none)"}

CATEGORIZED BY INFLUENCE × INTEREST:
- High Influence + High Interest: ${(categorized?.hi_hi || []).join(", ") || "(none)"}
- High Influence + Low Interest: ${(categorized?.hi_lo || []).join(", ") || "(none)"}
- Low Influence + High Interest: ${(categorized?.lo_hi || []).join(", ") || "(none)"}
- Low Influence + Low Interest: ${(categorized?.lo_lo || []).join(", ") || "(none)"}

KEY STAKEHOLDER NEEDS:
${
  Object.entries(needs || {}).length > 0
    ? Object.entries(needs || {})
        .map(([stakeholder, need]) => `- ${stakeholder}: ${need}`)
        .join("\n")
    : "(none recorded)"
}`;

      const userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

STUDENT'S STAKEHOLDER MAP:
${ideaSummary}

Help them see patterns and strategic implications. Which stakeholders are critical? What tensions exist between different stakeholder needs?`;

      const systemPrompt = buildInsightsSystemPrompt();
      const result = await callHaiku(systemPrompt, userPrompt, 300);

      logToolkitUsage("tools/stakeholder-map/insights", result, {
        sessionId,
        totalStakeholders: allStakeholders.length,
        action: "insights",
      });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("stakeholder-map", err);
  }
}
