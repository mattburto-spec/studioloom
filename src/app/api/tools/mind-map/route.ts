// audit-skip: public anonymous free-tool, no actor identity
/**
 * Mind Map Toolkit AI API
 *
 * Three Socratic interaction modes:
 *   1. "prompts"  — Generate contextual prompts for a mind map step (adaptive difficulty)
 *   2. "nudge"    — Effort-gated Socratic feedback after a student adds an idea
 *   3. "insights" — At the summary stage, find patterns and connections across all ideas
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

const MINDMAP_STEPS = [
  { step: 1, title: "Main Branches", desc: "brainstorming main topics or themes from the central concept" },
  { step: 2, title: "Sub-Branches", desc: "exploring each branch with specific sub-ideas and details" },
  { step: 3, title: "Connections", desc: "finding unexpected links and patterns between branches" },
];

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

function buildPromptsSystemPrompt(ideaCount: number): string {
  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written any ideas yet for this step.
- Start with accessible, concrete questions that connect to everyday experience
- First question should be the easiest entry point possible
- Gradually increase complexity across the 4 questions
- Use tangible examples in the questions`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} idea(s). Push in new directions.
- Avoid angles the student has already explored (see their existing ideas below)
- Questions should push toward less obvious aspects: different scales, different users, different contexts
- Mix one "what if" question with one "what about" and one "how would" question`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} ideas. Push into creative territory they haven't explored.
- These prompts should open NEW directions: unexpected connections, hidden relationships, synthesis
- Push for patterns: "What theme connects branch A and branch C?"
- Include one question that combines multiple branches
- Go for depth and synthesis — surprise them with connections they haven't noticed`;
  }

  return `You are a design thinking mentor helping a student create a mind map brainstorm.

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the student's challenge and the current mind map step. Questions should make the student think — not give them answers.

${difficultyInstruction}

RULES:
- Questions MUST reference specific aspects of their actual challenge
- Never suggest specific solutions or ideas — only ask questions that unlock thinking
- Each question should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings, each a question. Nothing else.
Example: ["What are the major themes that come up repeatedly?", "Who would care most about each of these branches?", "Which branches could combine into something new?", "What's missing or not yet explored?"]`;
}

function buildNudgeSystemPrompt(effortLevel: "low" | "medium" | "high"): string {
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague. Encourage them to flesh it out.
- Do NOT praise a vague idea — but stay warm and encouraging
- Ask them to paint the picture: what does it look like, who cares about it, why does it matter?
- Nudge for specifics that EXPAND the idea
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Build on their momentum.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Encourage them to explore FURTHER: deeper, wider, more angles
- Ask "what else could fit under this branch?" or "who else would care about this?"
- Spark adjacent thinking: "what related branches could develop from this?"`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and specific. Fuel their creative momentum.
- The "acknowledgment" should celebrate a SPECIFIC detail from their idea (3-8 words)
- Encourage them to branch out: what other angles, subtopics, or connections exist?
- Ask about implications: "what would that branch lead to?" or "how does this connect to other branches?"
- Push for synthesis: "could you combine this with another branch?"`,
  };

  return `You are an encouraging design thinking mentor. A student just added a branch or sub-idea to their mind map.

THIS IS IDEATION/DISCOVERY — your job is to keep creative exploration flowing. Never critique or evaluate ideas.
Your questions should help the student generate MORE branches and EXPAND on existing ones.

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive and generative.

RULES:
- "acknowledgment": 3-8 word note referencing their specific idea (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- The question must ENCOURAGE more ideas or EXPAND thinking
- Never critique or ask about problems with the idea
- Reference their specific idea — don't be generic
- Vary your approach — try "what if", "what else", "how about", "imagine if"

RESPONSE FORMAT: Return ONLY a JSON object, nothing else:
{"acknowledgment": "Great example of the ecosystem angle!", "nudge": "What other groups of people would connect to this branch?"}

For low effort:
{"acknowledgment": "", "nudge": "What specifically fits under that theme? Give me 2-3 examples or sub-topics."}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete mind map brainstorm.

YOUR ROLE: Help the student see PATTERNS, THEMES, and CONNECTIONS across their branches that they might not have noticed.

RULES:
- Identify 2-3 major themes or clusters that emerge from their branches
- Point out unexpected connections or overlaps between branches
- Suggest which branches are richest and why
- Ask 1-2 questions about what new branches could bridge gaps or synthesize ideas
- Be encouraging but intellectually honest — if branches cluster too tightly, note what's missing
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Never tell them which branch is "best" — help them see the landscape of their thinking

RESPONSE FORMAT: 2-3 short paragraphs of plain text. Use no headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "mind-map", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const stepIndex = body.stepIndex ?? 0;
      if (stepIndex < 0 || stepIndex > 2) {
        return Response.json({ error: "stepIndex must be 0-2" }, { status: 400 });
      }

      const step = MINDMAP_STEPS[stepIndex];
      const existingIdeas = (body.existingIdeas || []) as string[];

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

CURRENT MIND MAP STEP: Step ${step.step} — ${step.title} (${step.desc})`;

      if (existingIdeas.length > 0) {
        userPrompt += `\n\nIDEAS ALREADY GENERATED FOR THIS STEP:\n${existingIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}

Generate 4 NEW questions that push the student in DIFFERENT directions from their existing ideas. Don't repeat angles they've already explored.`;
      } else {
        userPrompt += `\n\nGenerate 4 thought-provoking questions specific to this challenge and this mind map step.`;
      }

      const result = await callHaiku(buildPromptsSystemPrompt(existingIdeas.length), userPrompt, 400);

      const prompts = parseToolkitJSONArray(result.text) || [
        `What are the main themes or categories related to "${challenge.trim()}"?`,
        `Who are the key people, groups, or systems involved?`,
        `What different perspectives or viewpoints exist on this topic?`,
        `What larger patterns or connections can you find?`,
      ];

      logToolkitUsage("tools/mind-map/prompts", result, { sessionId, stepIndex, action: "prompts" });
      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Effort-gated Socratic nudge ─── */
    if (action === "nudge") {
      const { idea, stepIndex, effortLevel: clientEffort } = body;
      if (!(idea as string)?.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const step = MINDMAP_STEPS[stepIndex ?? 0];
      const existingIdeas = (body.existingIdeas || []) as string[];
      const effort = (clientEffort as "low" | "medium" | "high") || "medium";

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"
MIND MAP STEP: Step ${step.step} — ${step.title}
IDEA JUST ADDED: "${(idea as string).trim()}"`;

      if (existingIdeas.length > 1) {
        userPrompt += `\nOTHER IDEAS IN THIS STEP: ${existingIdeas.filter(i => i !== (idea as string).trim()).join("; ")}`;
      }

      userPrompt += `\n\nReturn a JSON object with your acknowledgment and follow-up question.`;

      const result = await callHaiku(buildNudgeSystemPrompt(effort), userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/mind-map/nudge", result, { sessionId, stepIndex, action: "nudge", effortLevel: effort });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel: effort,
      });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const allIdeas = body.allIdeas as string[][] | undefined;
      if (!allIdeas || !Array.isArray(allIdeas)) {
        return Response.json({ error: "Missing allIdeas" }, { status: 400 });
      }

      const ideaSummary = MINDMAP_STEPS.map((step, i) => {
        const ideas = allIdeas[i] || [];
        if (ideas.length === 0) return `Step ${step.step} (${step.title}): No ideas`;
        return `Step ${step.step} (${step.title}):\n${ideas.map((idea, j) => `  ${j + 1}. ${idea}`).join("\n")}`;
      }).join("\n\n");

      const totalIdeas = allIdeas.reduce((sum, arr) => sum + arr.length, 0);

      const userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

ALL MIND MAP IDEAS (${totalIdeas} total):
${ideaSummary}

Help the student see patterns, themes, and unexpected connections across their branches. What emerges? What bridges exist? What directions might be worth developing further?`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 300);

      logToolkitUsage("tools/mind-map/insights", result, { sessionId, totalIdeas, action: "insights" });
      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("mind-map", err);
  }
}
