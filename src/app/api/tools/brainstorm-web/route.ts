/**
 * Brainstorm Web Toolkit AI API
 *
 * Three rounds of rapid brainstorming: initial burst, build & combine, wild ideas.
 * Encourages quantity and creativity over evaluation.
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

const BRAINSTORM_ROUNDS = [
  { round: 1, title: "Initial Burst", desc: "rapid-fire ideas with no filtering, pure divergent thinking" },
  { round: 2, title: "Build & Combine", desc: "combining, remixing, and building on existing ideas" },
  { round: 3, title: "Wild Ideas", desc: "pushing for impossible or absurd ideas then finding kernels of possibility" },
];

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

function buildPromptsSystemPrompt(ideaCount: number): string {
  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — This is the first idea the student is writing.
- Generate the easiest, most accessible prompts possible
- Focus on "what if" questions that spark immediate ideas
- Use concrete, everyday language
- Make it feel like free-flowing brainstorming, not a test`;
  } else if (ideaCount <= 3) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} idea(s). Keep the momentum going.
- Avoid angles they've already explored
- Push for QUANTITY: "what else?", "what more?", "what's another approach?"
- Mix practical and wild ideas
- Ask questions that spark combinations or new directions`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} ideas. Push into new territory.
- They've started the brainstorm — now go for wild, unusual directions
- Push for unexpected combinations or radical angles
- Ask "what if constraints didn't exist?" or "what would break all the rules?"
- Generate ideas they haven't considered yet`;
  }

  return `You are an encouraging brainstorming mentor. Your job is to fuel creative momentum and generate IDEAS, not judge them.

YOUR ROLE: Generate 4 thought-provoking prompts that spark NEW ideas. Never ask evaluative questions.

${difficultyInstruction}

RULES:
- Questions MUST reference specific aspects of their actual challenge
- Never suggest solutions or evaluate ideas — only ask questions that spark thinking
- Each prompt should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each prompt to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings, each a question. Nothing else.
Example: ["What's the wildest version of this idea?", "Who would this benefit in unexpected ways?", "What if you removed the biggest constraint?", "What would someone from a totally different field suggest?"]`;
}

function buildNudgeSystemPrompt(effortLevel: "low" | "medium" | "high"): string {
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or minimal. Push for expansion.
- Do NOT praise a vague idea — but stay warm and encouraging
- Challenge them to paint the picture: what does it look like, how does it work, who uses it?
- Nudge them to EXPAND the idea (not evaluate it)
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Build momentum.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Push them to EXPAND: "what else could this become?" or "how could you take this further?"
- Spark adjacent ideas: "what related ideas does this spark?"
- Keep the energy high and generative`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and creative. Fuel their momentum.
- The "acknowledgment" should celebrate a SPECIFIC detail from their idea (3-8 words)
- Encourage them to branch off: "what wild directions could this lead to?"
- Ask about combinations or mashups: "what would happen if you combined this with another idea?"
- Push for radical variations: "what's the most extreme version of this?"`,
  };

  return `You are an encouraging brainstorming mentor. A student just added an idea.

THIS IS PURE IDEATION — your job is to keep creative flow going, NOT to evaluate or critique.
Never ask about feasibility, flaws, trade-offs, or whether it "would work." That shuts down brainstorming.
Your questions should spark MORE ideas and EXPAND on existing ones.

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive and generative.

RULES:
- "acknowledgment": 3-8 word note referencing their specific idea (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- The question must ENCOURAGE more ideas or EXPAND thinking
- Never critique, evaluate, or ask about problems
- Reference their specific idea — don't be generic
- Vary your approach — try "what if", "what else", "how about", "imagine if"

RESPONSE FORMAT: Return ONLY a JSON object, nothing else:
{"acknowledgment": "Love the underwater angle!", "nudge": "What other extreme environments could this work in?"}

For low effort:
{"acknowledgment": "", "nudge": "What would that idea look like? How would it actually work in practice?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a brainstorming mentor reviewing all the ideas from a student's three-round session.

YOUR ROLE: Help the student see PATTERNS, THEMES, and OPPORTUNITIES they might have missed.

RULES:
- Identify 2-3 themes or clusters in the ideas (what keeps coming up?)
- Point out unexpected connections or combinations that could work
- Suggest which ideas have the most potential and why
- Ask 1-2 questions about how ideas could be combined or developed further
- Celebrate the quantity and diversity of ideas
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Never tell them which idea is "best" — help them see the landscape of their thinking

RESPONSE FORMAT: 2-3 short paragraphs of plain text. Use no headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "brainstorm-web", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const roundIndex = (body.roundIndex as number) ?? 0;
      if (roundIndex < 0 || roundIndex > 2) {
        return Response.json({ error: "roundIndex must be 0-2" }, { status: 400 });
      }

      const round = BRAINSTORM_ROUNDS[roundIndex];
      const existingIdeas = (body.existingIdeas || []) as string[];
      const challenge = (body.challenge as string) ?? "";

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

CURRENT BRAINSTORM ROUND: Round ${round.round} — ${round.title} (${round.desc})`;

      if (existingIdeas.length > 0) {
        userPrompt += `\n\nIDEAS ALREADY GENERATED FOR THIS ROUND:\n${existingIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}

Generate 4 NEW prompts that spark DIFFERENT ideas from what they've already written. Don't repeat angles they've already explored.`;
      } else {
        userPrompt += `\n\nGenerate 4 thought-provoking prompts to spark initial ideas.`;
      }

      const result = await callHaiku(buildPromptsSystemPrompt(existingIdeas.length), userPrompt, 400);

      const prompts = parseToolkitJSONArray(result.text) || (() => {
        if (roundIndex === 0) {
          return [
            `What's the first idea that comes to mind about "${challenge.trim()}"?`,
            `What if you had unlimited resources to solve this?`,
            `Who would benefit most from a solution to this problem?`,
            `What's something completely different you could try?`,
          ];
        } else if (roundIndex === 1) {
          return [
            `How could you combine two of your existing ideas?`,
            `What if you took your best idea and made it bigger or smaller?`,
            `How could you adapt one of your ideas for a different audience?`,
            `What if you merged the best parts of two different ideas?`,
          ];
        } else {
          return [
            `What's the most outrageous, impossible version of this?`,
            `What would aliens or robots suggest?`,
            `If failure wasn't a possibility, what would you try?`,
            `What if you completely reversed your approach?`,
          ];
        }
      })();

      logToolkitUsage("tools/brainstorm-web/prompts", result, { sessionId, roundIndex, action: "prompts" });
      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Effort-gated Socratic nudge ─── */
    if (action === "nudge") {
      const idea = (body.idea as string) ?? "";
      const roundIndex = (body.roundIndex as number) ?? 0;
      const clientEffort = body.effortLevel as "low" | "medium" | "high" | undefined;
      if (!idea.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const round = BRAINSTORM_ROUNDS[roundIndex];
      const challenge = (body.challenge as string) ?? "";
      const existingIdeas = (body.existingIdeas || []) as string[];
      const effort = (clientEffort as "low" | "medium" | "high") || "medium";

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"
BRAINSTORM ROUND: Round ${round.round} — ${round.title}
IDEA JUST ADDED: "${(idea as string).trim()}"`;

      if (existingIdeas.length > 1) {
        userPrompt += `\nOTHER IDEAS IN THIS ROUND: ${existingIdeas.filter(i => i !== (idea as string).trim()).join("; ")}`;
      }

      userPrompt += `\n\nReturn a JSON object with your acknowledgment and follow-up question.`;

      const result = await callHaiku(buildNudgeSystemPrompt(effort), userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/brainstorm-web/nudge", result, {
        sessionId,
        roundIndex,
        action: "nudge",
        effortLevel: effort,
      });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel: effort,
      });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const allIdeas = (body.allIdeas as string[][]) || [];
      if (!Array.isArray(allIdeas) || allIdeas.length === 0) {
        return Response.json({ error: "Missing allIdeas" }, { status: 400 });
      }

      const challenge = (body.challenge as string) ?? "";
      const ideaSummary = BRAINSTORM_ROUNDS.map((round, i) => {
        const ideas = allIdeas[i] || [];
        if (ideas.length === 0) return `Round ${round.round} (${round.title}): No ideas`;
        return `Round ${round.round} (${round.title}):\n${ideas.map((idea, j) => `  ${j + 1}. ${idea}`).join("\n")}`;
      }).join("\n\n");

      const totalIdeas = allIdeas.reduce((sum, arr) => sum + arr.length, 0);

      const userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

ALL BRAINSTORM IDEAS (${totalIdeas} total across 3 rounds):
${ideaSummary}

Help the student see patterns, themes, and promising directions across all their ideas. What clusters emerge? What connections exist between rounds? What combinations look most promising?`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 300);

      logToolkitUsage("tools/brainstorm-web/insights", result, { sessionId, totalIdeas, action: "insights" });
      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("brainstorm-web", err);
  }
}
