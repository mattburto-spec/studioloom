/**
 * PMI Chart Toolkit AI API
 *
 * 3 steps: Plus (benefits), Minus (risks), Interesting (neither good nor bad).
 * KEY: This is an EVALUATION tool — convergent thinking is correct here.
 * The "Interesting" column is the magic — push students to find things
 * that are NEITHER clearly good nor clearly bad.
 *
 * Three interaction modes:
 *   1. "prompts"  — Generate evaluation prompts for the current column
 *   2. "nudge"    — Effort-gated Socratic feedback per column
 *   3. "insights" — Cross-column synthesis at summary
 *
 * Uses Haiku 4.5 for speed. Short responses only — the student does the thinking.
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

// ─── Tool-specific config ───

const COLUMNS = [
  { name: "Plus", emoji: "➕", focus: "benefits, strengths, and advantages" },
  { name: "Minus", emoji: "➖", focus: "risks, weaknesses, and drawbacks" },
  { name: "Interesting", emoji: "🤔", focus: "intriguing observations that are neither clearly good nor bad" },
];

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

function buildPromptsSystemPrompt(colIndex: number, ideaCount: number): string {
  const col = COLUMNS[colIndex];

  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written anything yet for this column.
- Start with accessible, concrete questions that connect to everyday experience
- First question should be the easiest entry point for ${col.focus}
- Use tangible, specific language`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} point(s). Push in new directions.
- Avoid angles already explored (see their existing points below)
- Questions should push toward less obvious aspects of ${col.focus}`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} points. Push into unexplored territory.
- These prompts should open NEW analytical angles within ${col.focus}
- Push for surprising considerations, stakeholders they haven't thought about, edge cases`;
  }

  // Column-specific evaluation rules
  const colRules: Record<string, string> = {
    Plus: `COLUMN RULES (Plus — Benefits):
- Questions must help the student identify STRENGTHS, BENEFITS, and ADVANTAGES
- Push for specificity: "Who specifically benefits from this?" not just "What's good?"
- Ask about different stakeholders, time horizons, and contexts
- Encourage finding benefits that aren't immediately obvious
- Good: "What unexpected group of people might benefit?" Bad: "What could go wrong?"`,

    Minus: `COLUMN RULES (Minus — Drawbacks):
- Questions must help the student identify RISKS, WEAKNESSES, and DRAWBACKS
- Push for specificity: "What specific problem could this cause for X?" not just "Any downsides?"
- Ask about unintended consequences, who it fails for, edge cases
- Encourage honest critical thinking without being discouraging
- Good: "What could go wrong in the first week of use?" Bad: "What's good about this?"`,

    Interesting: `COLUMN RULES (Interesting — Intriguing Observations):
- THIS IS THE HARDEST AND MOST VALUABLE COLUMN — most students struggle here
- Questions must help the student find things that are NEITHER clearly good NOR clearly bad
- Push for observations, surprises, implications, open questions, and "huh, I never thought about that" moments
- Ask about side effects, unexpected connections, things that COULD go either way
- Encourage curiosity and wonder — this column is about noticing, not judging
- Good: "What's something about this idea that you can't easily label as good or bad?"
- Good: "What would happen if 1000 people used this — any surprising side effects?"
- Bad: "What's good about this?" (that's Plus) or "What's the risk?" (that's Minus)`,
  };

  return `You are a design thinking mentor guiding a student through a PMI Chart (Plus, Minus, Interesting) evaluation.

The student is currently working on the ${col.emoji} ${col.name} column, which focuses on ${col.focus}.

${colRules[col.name]}

${difficultyInstruction}

THIS IS AN EVALUATION TOOL — convergent, analytical thinking is correct here. Unlike brainstorming tools, you SHOULD ask about trade-offs, feasibility, risks (in the Minus column), and real-world implications.

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the student's design challenge AND appropriate for the ${col.name} column.

RULES:
- Questions MUST stay within the ${col.name} column's domain
- Reference specific aspects of their actual design challenge
- Never suggest specific answers — only ask questions
- Each question should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings. Nothing else.`;
}

// ─── Column-Specific Nudge Generation ───

function buildNudgeSystemPrompt(colIndex: number, effortLevel: "low" | "medium" | "high"): string {
  const col = COLUMNS[colIndex];

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague. Push for specifics.
- Do NOT praise a vague point — but stay warm and encouraging
- Ask them to be more specific: who, what, when, how, for whom?
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Deepen their analysis.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Push them to consider a specific stakeholder, time frame, or scenario they missed
- Ask "who else?" or "what about in a different context?"`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and analytical. Challenge further.
- The "acknowledgment" should celebrate a SPECIFIC analytical detail (3-8 words)
- Push for second-order effects, trade-offs, or considerations they haven't covered
- This student can handle harder follow-ups`,
  };

  const colTone: Record<string, string> = {
    Plus: "Your nudge should push for MORE and DEEPER benefits. Ask about different people, timeframes, or situations where this advantage plays out. 'Who else would benefit that you haven't considered?'",
    Minus: "Your nudge should push for MORE SPECIFIC risks and drawbacks. Avoid generic 'it might not work' — ask about specific failure scenarios. 'What happens if this fails on the first day?'",
    Interesting: "Your nudge should help them find MORE intriguing observations — things that are genuinely hard to categorize as good or bad. 'That's a great observation — what side effect of that could go either way?'",
  };

  return `You are an encouraging design thinking mentor. A student just added a point to the ${col.emoji} ${col.name} column of their PMI Chart.

${effortStrategy[effortLevel]}

${colTone[col.name]}

THIS IS AN EVALUATION TOOL — analytical depth is valued here. Push for specificity and real-world thinking.

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive but analytical.

RULES:
- "acknowledgment": 3-8 word note referencing their specific point (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words, staying within the ${col.name} column
- Reference their specific point — don't be generic
- Never suggest the answer in your question

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Sharp point about cost!", "nudge": "What would happen to that cost if the user base doubled?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you give a specific example of who would be affected and how?"}`;
}

// ─── Cross-Column Insights ───

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete PMI Chart. They have evaluated a design idea or challenge from three angles: Plus (benefits), Minus (risks), and Interesting (observations).

YOUR ROLE: Help the student see how their analysis CONNECTS across all three columns. This is about synthesis and decision-making.

RULES:
- Identify 1-2 key tensions between Plus and Minus columns (e.g., "The speed benefit you noted in Plus directly conflicts with the safety risk in Minus")
- Highlight the most insightful "Interesting" point and explain why it matters
- If the "Interesting" column is thin, note that — it's the hardest but most valuable column
- Ask 1 provocative question about what they should do NEXT with this analysis
- Be encouraging but honest — if analysis is surface-level, gently push for depth
- Keep the whole response under 120 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC points from their PMI Chart

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "pmi", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const stepIndex = (body.stepIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];
      const col = COLUMNS[Math.min(Math.max(stepIndex, 0), 2)];

      let userPrompt = `Design challenge or idea being evaluated: "${challenge}"
Current column: ${col.emoji} ${col.name} (${col.focus})
${existingIdeas.length > 0 ? `Student's existing points for this column:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "No points yet for this column."}

Generate 4 questions for the ${col.name} column.`;

      const result = await callHaiku(buildPromptsSystemPrompt(stepIndex, existingIdeas.length), userPrompt, 300);

      const prompts = parseToolkitJSONArray(result.text) || [
        `What's an interesting ${col.name.toLowerCase()} about this?`,
        `Who or what else could be affected?`,
        `What might not be immediately obvious?`,
        `What would happen in the long term?`,
      ];

      logToolkitUsage("tools/pmi/prompts", result, { sessionId, stepIndex, action: "prompts" });
      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Effort-gated Socratic nudge ─── */
    if (action === "nudge") {
      const stepIndex = (body.stepIndex as number) ?? 0;
      const idea = body.idea as string;
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";
      const existingIdeas = (body.existingIdeas || []) as string[];

      if (!idea?.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const col = COLUMNS[Math.min(Math.max(stepIndex, 0), 2)];

      let userPrompt = `Design challenge: "${challenge}"
Current column: ${col.emoji} ${col.name} (${col.focus})
Student's new point: "${idea}"
${existingIdeas.length > 0 ? `Their other points for this column:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "This is their first point for this column."}

Respond with your JSON feedback for the ${col.name} column.`;

      const result = await callHaiku(buildNudgeSystemPrompt(stepIndex, effortLevel), userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/pmi/nudge", result, { sessionId, stepIndex, action: "nudge", effortLevel });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Cross-column insights ─── */
    if (action === "insights") {
      const allIdeas = body.allIdeas as string[][] | undefined;
      if (!allIdeas || !Array.isArray(allIdeas)) {
        return Response.json({ error: "Missing allIdeas" }, { status: 400 });
      }

      const ideaSummary = COLUMNS.map((col, i) => {
        const points = allIdeas[i] || [];
        return `${col.emoji} ${col.name} (${col.focus}):\n${points.length > 0 ? points.map((t, j) => `  ${j + 1}. ${t}`).join("\n") : "  (no points recorded)"}`;
      }).join("\n\n");

      const userPrompt = `Design challenge: "${challenge}"

The student's PMI Chart:
${ideaSummary}

Synthesize their evaluation across all three columns.`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 300);

      logToolkitUsage("tools/pmi/insights", result, { sessionId, action: "insights" });
      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("pmi", err);
  }
}
