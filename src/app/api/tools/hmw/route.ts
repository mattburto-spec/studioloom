/**
 * How Might We (HMW) Toolkit AI API
 *
 * Guided Composition interaction shape — fundamentally different from Step Sequence (SCAMPER).
 *
 * Three Socratic interaction modes:
 *   1. "coach" — Effort-gated feedback on a single HMW statement (reframing quality check)
 *   2. "suggest" — Initial coaching prompts to help student think of different angles
 *   3. "synthesize" — At the summary stage, pick strongest statements and explain why
 *
 * Key differences from Step Sequence:
 *   - Not fixed steps, but iterative coaching rounds
 *   - AI provides FORMATIVE feedback on reframing quality (too broad? too narrow? solution-embedded?)
 *   - Variety detection: nudges students to explore DIFFERENT ANGLES (stakeholders, scales, timeframes)
 *   - DEFINE phase tone: analytical, encouraging, no wild divergence
 *
 * Education AI patterns:
 *   - Effort-gating: assess statement quality before choosing feedback strategy
 *   - Socratic feedback: acknowledge → ask a question targeting the gap
 *   - Staged cognitive load: initial prompts vs advanced angles based on statement count
 *   - Micro-feedback: immediate specific acknowledgment with quality indicators
 *   - Soft gating: suggestions hidden until student writes first statement
 *
 * Uses Haiku 4.5 for speed (student-facing). Short responses only — the student does the thinking.
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

function buildCoachSystemPrompt(effortLevel: "low" | "medium" | "high"): string {
  // DEFINE phase: analytical, problem-reframing tone (not ideation divergence, not evaluation critique)
  // Focus on reframing quality: is it solution-embedded? too broad? too narrow? good angle?
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The statement is brief or vague. Challenge them to be more specific.
- Do NOT praise a weak reframe — stay warm but direct
- Ask them to clarify: what specifically are they trying to solve? for whom?
- Nudge them toward CLARITY, not breadth or narrowness
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The statement shows decent reframing. Build on it.
- The "acknowledgment" should note ONE specific angle or perspective they captured (3-8 words)
- Challenge them to OPEN IT UP or NARROW IT DOWN as needed
- If it's too broad, nudge toward specificity: "Who specifically?"
- If it's too narrow, nudge toward breadth: "What else is at stake?"`,
    high: `EFFORT LEVEL: HIGH — The statement is well-framed and specific. Push for VARIATION.
- The "acknowledgment" should celebrate a SPECIFIC insight or perspective (3-8 words)
- Nudge them toward a DIFFERENT ANGLE: different stakeholder, different scale, different timeframe
- Ask: "What if you approached this from [different perspective]'s point of view?"
- Goal: help them explore the LANDSCAPE of the problem, not just one angle`,
  };

  return `You are a design thinking mentor helping a student reframe a design challenge into "How Might We" questions.

THIS IS DEFINE PHASE — your job is to help them find CLEAR, INSIGHTFUL problem framings.
Never ask about feasibility, trade-offs, or implementation — that comes later.
Focus on: Is this reframing insightful? Does it open up a new solution space? Is it solution-free?

${effortStrategy[effortLevel]}

QUALITY CHECKS FOR HMW STATEMENTS:
- ✓ Solution-free: doesn't embed a specific solution (e.g., "HMW build X?" is bad)
- ✓ Specific enough: targets a clear aspect of the challenge, not too vague
- ✓ Broad enough: opens up creative possibilities, not too narrow
- ✓ Good angle: reframes the problem in an interesting way

YOUR ROLE: Return a JSON object with your feedback. Keep the tone analytical but encouraging.

RULES:
- "acknowledgment": 3-8 word note referencing their specific reframe (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- Reference their specific statement — don't be generic
- For low effort: push for clarity and specificity
- For medium effort: ask if it's too broad or too narrow, suggest tightening
- For high effort: nudge toward exploring a DIFFERENT angle or perspective

RESPONSE FORMAT: Return ONLY a JSON object, nothing else:
{"acknowledgment": "Great angle on student access!", "nudge": "What if you focused on the teacher's perspective instead — what barriers do THEY see?"}

For low effort:
{"acknowledgment": "", "nudge": "What exactly is the challenge? Who does it affect most?"}`;
}

function buildSuggestSystemPrompt(statementCount: number): string {
  // Staged cognitive load: adapt suggestion difficulty based on how many statements written
  let difficultyInstruction: string;
  if (statementCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written any statements yet.
- Suggest angles that are ACCESSIBLE and connect to everyday experience
- Focus on different STAKEHOLDERS or SCALES: students vs teachers vs families vs school system
- First suggestion should be the easiest entry point possible
- Gradually introduce more complex reframing angles across the 4 suggestions`;
  } else if (statementCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${statementCount} statement(s). Push in new directions.
- Avoid angles they've already explored (see their existing statements below)
- Suggest perspectives they haven't tried: different stakeholders, different scales, different timeframes
- Mix STAKEHOLDER angles ("From the teacher's view...") with SCALE angles ("At the school level...")`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${statementCount} statements. Explore sophisticated angles.
- These suggestions should open NOVEL reframing directions: systems thinking, temporal shifts, emotion, ethics
- Suggest: "What if this wasn't a problem but an opportunity?" or "What would a 10-year view change?"
- Include one suggestion that combines multiple perspectives ("How might we serve BOTH students AND teachers?")
- Push for unexpected angles — surprise them into thinking differently about the challenge`;
  }

  return `You are a design thinking mentor helping a student generate "How Might We" questions.

YOUR ROLE: Suggest 4 coaching prompts that nudge the student toward DIFFERENT ANGLES and PERSPECTIVES on their design challenge.

${difficultyInstruction}

PERSPECTIVE TYPES TO MIX:
- Stakeholder shifts: "From the [different person]'s perspective..."
- Scale shifts: "At the school level / classroom level / district level..."
- Temporal shifts: "In 5 years / from the past / in an emergency..."
- Emotion/value shifts: "For someone who is [emotion/goal]..."
- Systems shifts: "What if we viewed this as a systemic problem, not individual..."

RULES:
- Each suggestion should inspire a NEW ANGLE, not repeat what they've already explored
- Suggestions are coaching prompts, not full HMW statements — leave the framing to the student
- Use simple, clear language suitable for ages 11-18
- Each suggestion should be 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings, each a coaching prompt. Nothing else.
Example: ["What if you approached this from the teacher's perspective — what's their biggest pain point?", "How would this challenge look different if you zoomed out to the entire school system?", "What if you had unlimited resources — how would your thinking shift?", "Who else beyond the obvious users might be affected by this problem?"]`;
}

function buildSynthesizeSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete set of "How Might We" reframings.

YOUR ROLE: Help the student see which statements are STRONGEST and WHY. Synthesis, not judgment.

RULES FOR IDENTIFYING STRONG HMW STATEMENTS:
- ✓ Solution-free: doesn't embed a specific solution
- ✓ Insightful angle: reframes the problem in an interesting, unexpected way
- ✓ Specific enough: targets a clear aspect, not too vague
- ✓ Broad enough: opens up creative possibilities, not too narrow
- ✓ Opens new directions: would lead to different ideas than the original challenge statement

ANALYSIS:
- Identify the 2-3 strongest statements and briefly explain WHY (one sentence per statement)
- Note any patterns across their statements (what angles did they favor? what did they miss?)
- Ask 1 provocative question about which statement(s) might lead to the most interesting ideas
- Be encouraging but intellectually honest — what's the landscape of their thinking?
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18

RESPONSE FORMAT: 2-3 short paragraphs of plain text. Use no headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "hmw", ["coach", "suggest", "synthesize"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Coach on a single statement ─── */
    if (action === "coach") {
      const statement = body.statement as string;
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";
      const existingStatements = (body.existingStatements || []) as string[];

      if (!statement?.trim()) {
        return Response.json({ error: "Missing statement" }, { status: 400 });
      }

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"
STATEMENT JUST WRITTEN: "How might we ${statement.trim()}?"`;

      if (existingStatements.length > 0) {
        userPrompt += `\n\nOTHER HMW STATEMENTS ALREADY WRITTEN:\n${existingStatements.map((s, i) => `${i + 1}. How might we ${s}?`).join("\n")}

Check whether this new statement explores a DIFFERENT ANGLE or perspective from the ones above. If it's too similar, nudge them toward a fresh angle.`;
      }

      userPrompt += `\n\nReturn a JSON object with your feedback.`;

      const result = await callHaiku(buildCoachSystemPrompt(effortLevel), userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/hmw/coach", result, { sessionId, action: "coach", effortLevel, statementCount: existingStatements.length + 1 });

      return Response.json({
        coach: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Suggest coaching prompts for different angles ─── */
    if (action === "suggest") {
      const statementCount = (body.statementCount as number) ?? 0;
      const existingStatements = (body.existingStatements || []) as string[];

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"
STATEMENTS ALREADY WRITTEN: ${statementCount}`;

      if (statementCount > 0 && existingStatements.length > 0) {
        userPrompt += `\n\nEXISTING STATEMENTS:\n${existingStatements.map((s, i) => `${i + 1}. How might we ${s}?`).join("\n")}`;
        userPrompt += `\n\nSuggest 4 NEW angles that approach the challenge from DIFFERENT PERSPECTIVES.`;
      } else {
        userPrompt += `\n\nSuggest 4 initial angles that represent different perspectives on the challenge.`;
      }

      const result = await callHaiku(buildSuggestSystemPrompt(statementCount), userPrompt, 400);

      const suggestions = parseToolkitJSONArray(result.text) || [
        `What if you approached this from a student's perspective instead of a teacher's?`,
        `How would your thinking change if you zoomed out to the whole school system?`,
        `What if you focused on the emotional experience rather than the logistics?`,
        `How might this challenge look different in 5 years, when the context has shifted?`,
      ];

      logToolkitUsage("tools/hmw/suggest", result, { sessionId, action: "suggest", statementCount });

      return Response.json({ suggestions: suggestions.slice(0, 4) });
    }

    /* ─── Action: Synthesis at summary ─── */
    if (action === "synthesize") {
      const allStatements = body.allStatements as string[] | undefined;
      if (!allStatements || !Array.isArray(allStatements)) {
        return Response.json({ error: "Missing allStatements" }, { status: 400 });
      }

      const statementList = allStatements
        .map((s, i) => `${i + 1}. How might we ${s}?`)
        .join("\n");

      const userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

ALL HMW STATEMENTS (${allStatements.length} total):
${statementList}

Review these reframings. Which are the strongest and why? What patterns do you see? What might they be missing? Help the student see the landscape of their thinking.`;

      const result = await callHaiku(buildSynthesizeSystemPrompt(), userPrompt, 300);

      logToolkitUsage("tools/hmw/synthesize", result, { sessionId, action: "synthesize", statementCount: allStatements.length });

      return Response.json({ synthesis: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("hmw", err);
  }
}
