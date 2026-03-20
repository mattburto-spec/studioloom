/**
 * Lotus Diagram Toolkit AI API
 *
 * Three interaction modes:
 *   1. "prompts"  — Generate contextual prompts for a petal (adaptive difficulty)
 *   2. "nudge"    — Effort-gated Socratic feedback after adding an idea
 *   3. "insights" — Synthesis across all petals, find themes and connections
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

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

function buildPromptsSystemPrompt(ideaCount: number): string {
  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written any ideas for this petal yet.
- Start with accessible, concrete questions
- First question should be the easiest entry point possible
- Use tangible examples`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} idea(s).
- Avoid angles they've already explored
- Push toward less obvious aspects: different users, different contexts, different scales
- Mix question types: "what if", "who else", "what assumption"`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} ideas.
- Push into creative territory not yet explored
- Open NEW directions: unexpected angles, different eras, cultures, scales
- Go for surprising combinations`;
  }

  return `You are a design thinking mentor helping a student develop ideas within a Lotus Diagram petal.

THIS IS IDEATION — your job is to keep creative momentum flowing, NOT to evaluate or critique ideas.
Never ask about flaws, feasibility, or what could go wrong. That belongs in evaluation, not here.

${difficultyInstruction}

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the petal theme and challenge.

RULES:
- Questions MUST reference specific aspects of their actual petal theme
- Never suggest solutions — only ask questions that unlock thinking
- Each question should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings. Nothing else.
Example: ["What if you focused on the youngest users?", "How would professionals approach this?", "What if cost were no object?", "What solution exists in nature?"]`;
}

function buildNudgeSystemPrompt(effortLevel: "low" | "medium" | "high"): string {
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The response is brief or vague.
- Do NOT praise a vague idea
- Push for specifics: what does it look like, feel like, who would use it?
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort.
- The "acknowledgment" should note ONE specific detail (3-8 words)
- Encourage them to push FURTHER: bigger, wilder, more creative
- Ask "what if you took that even further?"`,
    high: `EFFORT LEVEL: HIGH — The response is detailed and specific.
- The "acknowledgment" should celebrate a SPECIFIC detail (3-8 words)
- Fuel their momentum: ask about related ideas or unexpected combinations
- Push for creative leaps`,
  };

  return `You are an encouraging design thinking mentor. A student just added an idea to their Lotus Diagram petal.

THIS IS IDEATION — keep creative momentum flowing, NOT evaluate ideas.
Never ask about flaws, feasibility, trade-offs, or what could go wrong.

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback.

RULES:
- "acknowledgment": 3-8 word note referencing their specific idea (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- The question must ENCOURAGE more ideas or EXPAND on the current one
- Never critique or evaluate
- Reference their specific idea
- Vary your approach

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Love the angle on affordability!", "nudge": "What if you pushed that idea even further — what's the most extreme version?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete Lotus Diagram. They started with a central theme, developed 8 sub-themes (petals), and generated multiple ideas within each.

YOUR ROLE: Help the student see PATTERNS and CONNECTIONS across petals that they might not have noticed.

RULES:
- Identify 2-3 themes that appear across multiple petals
- Point out unexpected connections between ideas from different petals
- Ask 1-2 questions about which ideas could be combined or developed further
- Be encouraging but intellectually honest
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC ideas from their petals

RESPONSE FORMAT: 2-3 short paragraphs of plain text. Use no headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "lotus-diagram", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, theme, sessionId } = body;

  try {
    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const petalTheme = body.petalTheme ?? "";
      const petalIndex = (body.petalIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];
      const theme = (body.theme as string) ?? "";

      if (!petalTheme?.toString().trim()) {
        return Response.json({ error: "Missing petalTheme" }, { status: 400 });
      }

      const systemPrompt = buildPromptsSystemPrompt(existingIdeas.length);
      let userPrompt = `Central theme: "${theme.trim()}"
Petal sub-theme: "${petalTheme.toString().trim()}"
Petal index: ${petalIndex}

${existingIdeas.length > 0 ? `Existing ideas for this petal:\n${existingIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}\n\nGenerate 4 NEW questions that push in DIFFERENT directions from these ideas.` : "Generate 4 thought-provoking questions specific to this petal theme."}`;

      const result = await callHaiku(systemPrompt, userPrompt, 400);

      const prompts = parseToolkitJSONArray(result.text) || [
        `What would ${petalTheme.toString().toLowerCase()} look like if you focused on the most unusual angle?`,
        `How might someone from a completely different field approach ${petalTheme.toString().toLowerCase()}?`,
        `What assumption are you making about ${petalTheme.toString().toLowerCase()} that might not be true?`,
        `If ${petalTheme.toString().toLowerCase()} had to solve a completely different problem, what would it look like?`,
      ];

      logToolkitUsage("tools/lotus-diagram/prompts", result, { sessionId, petalIndex, action: "prompts" });

      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Effort-gated Socratic nudge ─── */
    if (action === "nudge") {
      const idea = (body.idea as string) ?? "";
      const petalTheme = body.petalTheme ?? "";
      const petalIndex = (body.petalIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";
      const theme = (body.theme as string) ?? "";

      if (!idea.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }
      if (!petalTheme?.toString().trim()) {
        return Response.json({ error: "Missing petalTheme" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(effortLevel);
      let userPrompt = `Central theme: "${theme.trim()}"
Petal: "${petalTheme.toString().trim()}"
Idea just added: "${idea.trim()}"
${existingIdeas.length > 1 ? `Other ideas in this petal: ${existingIdeas.filter(i => i !== idea.trim()).join("; ")}` : ""}

Respond with JSON feedback.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/lotus-diagram/nudge", result, { sessionId, petalIndex, effortLevel, action: "nudge" });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const petals = (body.petals || []) as string[];
      const allIdeas = (body.allIdeas || []) as string[][];
      const theme = (body.theme as string) ?? "";

      if (!Array.isArray(allIdeas) || allIdeas.length === 0) {
        return Response.json({ insights: "" });
      }

      const systemPrompt = buildInsightsSystemPrompt();
      const ideaSummary = petals
        .map((petal, i) => {
          const ideas = allIdeas[i] || [];
          if (ideas.length === 0) return `${petal}: (no ideas)`;
          return `${petal}:\n${ideas.map((idea, j) => `  ${j + 1}. ${idea}`).join("\n")}`;
        })
        .join("\n\n");

      const userPrompt = `Central theme: "${theme.trim()}"

All 8 petals and their ideas:
${ideaSummary}

Help the student see patterns and connections across their ideas.`;

      const result = await callHaiku(systemPrompt, userPrompt, 300);

      logToolkitUsage("tools/lotus-diagram/insights", result, {
        sessionId,
        totalIdeas: allIdeas.reduce((sum, arr) => sum + arr.length, 0),
        action: "insights",
      });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("lotus-diagram", err);
  }
}
