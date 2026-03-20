/**
 * SWOT Analysis Toolkit AI API
 *
 * Four quadrants: Strengths, Weaknesses, Opportunities, Threats.
 * KEY: This is an EVALUATION/ANALYSIS tool — convergent, analytical thinking is correct here.
 *
 * Three interaction modes:
 *   1. "prompts"  — Generate analytical questions for the current quadrant
 *   2. "nudge"    — Effort-gated Socratic feedback per quadrant
 *   3. "insights" — Cross-quadrant synthesis at summary
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

// ─── Tool-specific config ───

const QUADRANTS = [
  { name: "Strengths", focus: "internal positive attributes" },
  { name: "Weaknesses", focus: "internal negative attributes" },
  { name: "Opportunities", focus: "external positive factors" },
  { name: "Threats", focus: "external negative factors" },
];

// ─── Tool-specific prompt builders ───

function buildPromptsSystemPrompt(quadIndex: number, ideaCount: number): string {
  const quad = QUADRANTS[quadIndex];

  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written anything yet for this quadrant.
- Start with accessible, concrete questions that connect to everyday experience
- First question should be the easiest entry point for ${quad.focus}
- Use tangible, specific language`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} point(s). Push in new directions.
- Avoid angles already explored (see their existing points below)
- Questions should push toward less obvious aspects of ${quad.focus}`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} points. Push into unexplored territory.
- These prompts should open NEW analytical angles within ${quad.focus}
- Push for surprising considerations, stakeholders they haven't thought about, edge cases`;
  }

  const quadRules: Record<string, string> = {
    Strengths: `QUADRANT RULES (Strengths — Internal Positive):
- Questions must help the student identify REAL STRENGTHS, CAPABILITIES, and COMPETITIVE ADVANTAGES
- Push for specificity and evidence: "What skills do you have that competitors don't?" not just "What are you good at?"
- Ask about different types of strengths: skills, resources, reputation, team, partnerships
- Encourage finding strengths that aren't immediately obvious
- Help them see how strengths can be leveraged
- Good: "What specific capability would be hard for someone else to copy?"
- Bad: "What's weak about this?"`,

    Weaknesses: `QUADRANT RULES (Weaknesses — Internal Negative):
- Questions must help the student identify HONEST WEAKNESSES, LIMITATIONS, and AREAS FOR IMPROVEMENT
- Push for specificity without being discouraging: "What skill gap would limit you?" not just "Any weaknesses?"
- Ask about different types of weaknesses: skills, resources, inexperience, processes, team gaps
- Encourage candid self-assessment — this is where real insight happens
- Help them distinguish between "we don't have that resource yet" vs. "we can't do that"
- Good: "What would be hardest for you to do with your current resources?"
- Bad: "What's good about this?"`,

    Opportunities: `QUADRANT RULES (Opportunities — External Positive):
- Questions must help the student identify EXTERNAL OPPORTUNITIES, MARKET GAPS, and FAVORABLE CONDITIONS
- Push for specificity about timing, context, and conditions: "What trend in the next 2 years could help?" not just "Any opportunities?"
- Ask about different sources: market trends, technology, partnerships, regulatory changes, emerging user needs
- Encourage finding opportunities that might not be obvious yet
- Help them think about "if X happens, what becomes possible?"
- Good: "What new market or user group could emerge that would benefit from your solution?"
- Bad: "What could go wrong?" (that's Threats)`,

    Threats: `QUADRANT RULES (Threats — External Negative):
- Questions must help the student identify REALISTIC EXTERNAL THREATS, RISKS, and UNFAVORABLE CONDITIONS
- Push for specificity about what could actually go wrong: "Which competitor move would hurt most?" not just "Any risks?"
- Ask about different sources: competitors, market changes, regulations, technology shifts, economic factors
- Encourage realistic risk assessment — neither catastrophizing nor dismissing real risks
- Help them distinguish between "unlikely but catastrophic" vs. "likely and manageable"
- Good: "What external change could make your solution less valuable?"
- Bad: "What's good about this?" (that's Opportunities)`,
  };

  return `You are a design thinking mentor guiding a student through a SWOT Analysis.

The student is currently working on the ${quad.name} quadrant, which focuses on ${quad.focus}.

${quadRules[quad.name]}

${difficultyInstruction}

THIS IS AN ANALYSIS TOOL — convergent, analytical thinking is correct here. Unlike brainstorming tools, you SHOULD ask about trade-offs, feasibility, risks, and real-world implications.

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the student's design challenge AND appropriate for the ${quad.name} quadrant.

RULES:
- Questions MUST stay within the ${quad.name} quadrant's domain
- Reference specific aspects of their actual design challenge
- Never suggest specific answers — only ask questions
- Each question should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings. Nothing else.`;
}

function buildNudgeSystemPrompt(quadIndex: number, effortLevel: "low" | "medium" | "high"): string {
  const quad = QUADRANTS[quadIndex];

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague. Push for specifics.
- Do NOT praise a vague point — but stay warm and encouraging
- Ask them to be more specific: who, what, when, how, for whom?
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Deepen their analysis.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Push them to consider a specific stakeholder, context, or scenario they missed
- Ask "who else might be affected?" or "what about in a different context?"`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and analytical. Challenge further.
- The "acknowledgment" should celebrate a SPECIFIC analytical detail (3-8 words)
- Push for second-order effects, trade-offs, or implications they haven't covered
- This student can handle harder follow-ups`,
  };

  const quadTone: Record<string, string> = {
    Strengths:
      "Your nudge should push for MORE SPECIFIC strengths and ask how they can be leveraged. 'How would you use that strength to stand out?'",
    Weaknesses:
      "Your nudge should push for MORE HONEST ASSESSMENT of limitations. 'What would be the hardest part to improve or work around?'",
    Opportunities:
      "Your nudge should push for MORE SPECIFIC external opportunities — timing, context, who. 'What conditions would need to be true for that opportunity to happen?'",
    Threats:
      "Your nudge should push for MORE REALISTIC threats assessment. 'How likely is that, and what could you do to prevent or mitigate it?'",
  };

  return `You are an encouraging design thinking mentor. A student just added a point to the ${quad.name} quadrant of their SWOT Analysis.

${effortStrategy[effortLevel]}

${quadTone[quad.name]}

THIS IS AN ANALYSIS TOOL — analytical depth is valued here. Push for specificity and real-world thinking.

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive but analytical.

RULES:
- "acknowledgment": 3-8 word note referencing their specific point (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words, staying within the ${quad.name} quadrant
- Reference their specific point — don't be generic
- Never suggest the answer in your question

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Good thinking about resources!", "nudge": "What other resources would be hard to access or develop?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you give a specific example of what you mean?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete SWOT Analysis. They have evaluated a design idea from four angles: Strengths, Weaknesses, Opportunities, and Threats.

YOUR ROLE: Help the student see how their analysis CONNECTS across all four quadrants. This is about synthesis, strategy, and decision-making.

RULES:
- Identify 1-2 key tensions between quadrants (e.g., "Your strength in X directly counters the threat of Y", "Your weakness in X is an opportunity for partnership")
- Highlight the most insightful point from each quadrant
- Point out patterns: are most threats related, are most opportunities dependent on each other, etc.
- Ask 1 provocative question about what they should do NEXT with this analysis: focus on strengths? Shore up weaknesses? Pursue opportunities? Mitigate threats?
- Be encouraging but honest — if analysis is surface-level, gently push for depth
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC points from their SWOT analysis

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "swot", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const quadrantIndex = (body.quadrantIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];
      const quad = QUADRANTS[quadrantIndex];

      if (!quad) {
        return Response.json({ error: "Invalid quadrant index" }, { status: 400 });
      }

      const systemPrompt = buildPromptsSystemPrompt(quadrantIndex, existingIdeas.length);
      const userPrompt = `Design challenge or idea being analyzed: "${challenge}"
Current quadrant: ${quad.name} (${quad.focus})
${existingIdeas.length > 0 ? `Student's existing points for this quadrant:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "No points yet for this quadrant."}

Generate 4 questions for the ${quad.name} quadrant.`;

      const result = await callHaiku(systemPrompt, userPrompt, 300);
      const prompts = parseToolkitJSONArray(result.text) || [];

      logToolkitUsage("tools/swot/prompts", result, { sessionId, quadrantIndex, action: "prompts" });

      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Effort-gated nudge ─── */
    if (action === "nudge") {
      const idea = (body.idea as string) ?? "";
      const quadrantIndex = (body.quadrantIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";

      if (!idea.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const quad = QUADRANTS[quadrantIndex];
      if (!quad) {
        return Response.json({ error: "Invalid quadrant index" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(quadrantIndex, effortLevel);
      const userPrompt = `Design challenge: "${challenge}"
Current quadrant: ${quad.name} (${quad.focus})
Student's new point: "${idea}"
${existingIdeas.length > 0 ? `Their other points for this quadrant:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "This is their first point for this quadrant."}

Respond with your JSON feedback for the ${quad.name} quadrant.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/swot/nudge", result, { sessionId, quadrantIndex, effortLevel, action: "nudge" });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const allIdeas = (body.allIdeas || []) as string[][];

      if (allIdeas.every((arr) => arr.length === 0)) {
        return Response.json({ insights: "" });
      }

      const systemPrompt = buildInsightsSystemPrompt();
      const userPrompt = `Design challenge: "${challenge}"

The student's SWOT Analysis:
${QUADRANTS.map((quad, i) => {
  const points = allIdeas[i] || [];
  return `${quad.name} (${quad.focus}):\n${points.length > 0 ? points.map((t, j) => `  ${j + 1}. ${t}`).join("\n") : "  (no points recorded)"}`;
}).join("\n\n")}

Synthesize their analysis across all four quadrants.`;

      const result = await callHaiku(systemPrompt, userPrompt, 300);

      logToolkitUsage("tools/swot/insights", result, { sessionId, action: "insights" });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("swot", err);
  }
}
