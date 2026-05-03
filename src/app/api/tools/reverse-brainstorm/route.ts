// audit-skip: public anonymous free-tool, no actor identity
/**
 * Reverse Brainstorm Toolkit AI API
 *
 * Two-phase ideation tool:
 *   1. "prompts"  — Generate prompts for thinking of "bad ideas" or "flips"
 *   2. "nudge"    — Effort-gated Socratic feedback after a student adds an idea
 *   3. "insights" — Synthesis across bad ideas and their flipped solutions
 *
 * IDEATION PHASE: encourage divergent thinking in step 1 (generating bad ideas),
 * then analytical thinking in step 2 (flipping them into solutions).
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

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

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
- Questions should push toward less obvious aspects, edge cases, different users
- Mix different approaches`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} ideas. Push into creative territory they haven't explored.
- These prompts should open NEW creative directions
- Go for unexpected angles — surprise them into thinking differently`;
  }

  const stepRules =
    stepIndex === 0
      ? `STEP 1 — "How to CAUSE the Problem":
- This is DIVERGENT thinking. Encourage wild, absurd, even funny bad ideas.
- Push for "worst case scenarios" and sabotage thinking.
- Get students thinking like tricksters or villains — what would DELIBERATELY make the problem worse?
- Examples: Instead of "make it cheaper," ask "what if we made it as expensive as possible?"
- This is ideation, NOT evaluation — no judgment, pure creativity.`
      : `STEP 2 — "Flip It" (Turn Bad Ideas into Solutions):
- This is more ANALYTICAL. Students take their bad ideas and find the logical opposite.
- Help them see that if causing the problem means doing X, solving it means doing the OPPOSITE of X.
- Push them to articulate the inversion clearly and logically.
- Example: "If making the problem means 'use cheap materials,' flipping it means 'use durable, quality materials.'";
- This step requires more reasoning — the flip must make sense.`;

  return `You are a design thinking mentor helping a student use the Reverse Brainstorm technique.

${stepRules}

${difficultyInstruction}

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the student's design challenge.

RULES:
- Questions MUST reference specific aspects of their actual challenge
- Never suggest specific ideas — only ask questions that unlock thinking
- Each question should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings, each a question. Nothing else.`;
}

function buildNudgeSystemPrompt(stepIndex: number, effortLevel: "low" | "medium" | "high"): string {
  // Step 1 is IDEATION (divergent), Step 2 is more ANALYTICAL (convergent)
  const phaseStrategy =
    stepIndex === 0
      ? `THIS IS IDEATION — your job is to keep creative momentum flowing, NOT to evaluate or critique ideas.
Never ask about flaws, feasibility, or what could go wrong. That belongs in evaluation, not here.
Your questions should help the student generate MORE bad ideas and push them further.`
      : `THIS IS ANALYTICAL — help students see the logical inversion of their bad ideas.
Push for clarity and reasoning about how flipping the idea actually solves the problem.
This step requires more depth than pure ideation.`;

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague. Encourage them to flesh it out.
- Do NOT praise a vague idea — but stay warm and encouraging
- Ask them to paint the picture: what does it look like, how would it work, what would change?
- Nudge for specifics that EXPAND the idea
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Build on their momentum.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Encourage them to push the idea FURTHER or think about how it connects to their other ideas
- Ask "what else could that lead to?" or "what would a completely different version look like?"`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and specific. Fuel their creative momentum.
- The "acknowledgment" should celebrate a SPECIFIC detail from their idea (3-8 words)
- Encourage them to branch out: what RELATED ideas does this spark?
- Push for creative leaps or logical connections to their other ideas`,
  };

  return `You are an encouraging design thinking mentor. A student just added an idea to their Reverse Brainstorm.

${phaseStrategy}

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive and generative.

RULES:
- "acknowledgment": 3-8 word note referencing their specific idea (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- Reference their specific idea — don't be generic
- Vary your approach — try "what if", "what else", "how about", "imagine if"

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Love the sabotage angle!", "nudge": "What other ways could someone deliberately make this problem happen?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you describe specifically what would happen and who would be affected?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete Reverse Brainstorm session.

They have:
1. Brainstormed "bad ideas" — ways to deliberately CAUSE or WORSEN the problem
2. Flipped each bad idea into a potential solution

YOUR ROLE: Help them see patterns, connections, and themes across their thinking. This is about synthesis and revealing the logic of their inversions.

RULES:
- Identify 1-2 recurring themes in their bad ideas (what kinds of things go wrong most often?)
- Point out which flips are strongest — where the inversion is most clever or promising
- Highlight surprising connections or insights they might have missed
- Ask 1 provocative question about what they should build on or test first
- Be encouraging but honest — if analysis is surface-level, gently push for depth
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Never tell them which idea is "best" — help them see the landscape of their thinking

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "reverse-brainstorm", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const stepIndex = (body.stepIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];

      if (stepIndex < 0 || stepIndex > 1) {
        return Response.json({ error: "stepIndex must be 0-1" }, { status: 400 });
      }

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

CURRENT STEP: ${stepIndex === 0 ? "1 - How to CAUSE the Problem" : "2 - Flip It"}`;

      if (existingIdeas.length > 0) {
        userPrompt += `\n\nIDEAS ALREADY GENERATED:\n${existingIdeas
          .map((idea, i) => `${i + 1}. ${idea}`)
          .join("\n")}

Generate 4 NEW questions that push the student in DIFFERENT directions from their existing ideas.`;
      } else {
        userPrompt += `\n\nGenerate 4 thought-provoking questions specific to this challenge and this step.`;
      }

      const result = await callHaiku(buildPromptsSystemPrompt(stepIndex, existingIdeas.length), userPrompt, 400);

      const prompts = parseToolkitJSONArray(result.text) || [
        stepIndex === 0
          ? "What would someone do to deliberately make this problem worse?"
          : "What's the opposite of that bad idea, and how does it solve the problem?",
        stepIndex === 0
          ? "If your goal was sabotage, what would you change?"
          : "What would reversing that action look like in practice?",
        stepIndex === 0
          ? "What if you made the problem 10x more severe?"
          : "How does flipping that idea lead to a better solution?",
        stepIndex === 0
          ? "What would an enemy of the solution deliberately do?"
          : "What's the logical opposite of what would cause the problem?",
      ];

      logToolkitUsage("tools/reverse-brainstorm/prompts", result, { sessionId, stepIndex, action: "prompts" });

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

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"
CURRENT STEP: ${stepIndex === 0 ? "1 - How to CAUSE the Problem" : "2 - Flip It"}
IDEA JUST ADDED: "${idea.trim()}"`;

      if (existingIdeas.length > 1) {
        userPrompt += `\nOTHER IDEAS IN THIS STEP: ${existingIdeas.filter((i) => i !== idea.trim()).join("; ")}`;
      }

      userPrompt += `\n\nReturn a JSON object with your acknowledgment and follow-up question.`;

      const result = await callHaiku(buildNudgeSystemPrompt(stepIndex, effortLevel), userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/reverse-brainstorm/nudge", result, { sessionId, stepIndex, action: "nudge", effortLevel });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const badIdeas = (body.badIdeas || []) as string[];
      const flips = (body.flips || []) as { bad: string; good: string }[];

      if (badIdeas.length === 0 && flips.length === 0) {
        return Response.json({ insights: "" });
      }

      const ideaSummary = `BAD IDEAS (Ways to Cause the Problem):
${badIdeas.length > 0 ? badIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n") : "(none)"}

FLIPPED SOLUTIONS:
${flips.length > 0 ? flips.map((flip, i) => `${i + 1}. ${flip.good}`).join("\n") : "(none)"}`;

      const userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

STUDENT'S REVERSE BRAINSTORM SESSION:
${ideaSummary}

Help them see patterns and connections in their thinking. What themes emerge? Which flips are strongest? What should they build on next?`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 300);

      logToolkitUsage("tools/reverse-brainstorm/insights", result, { sessionId, totalIdeas: badIdeas.length + flips.length, action: "insights" });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("reverse-brainstorm", err);
  }
}
