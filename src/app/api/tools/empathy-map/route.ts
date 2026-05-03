// audit-skip: public anonymous free-tool, no actor identity
/**
 * Empathy Map Toolkit AI API
 *
 * 4 quadrants: Says, Thinks, Does, Feels — each treated as a step.
 * This is a RESEARCH tool — push for depth and specificity.
 * KEY: "What exact words would they use?" not "What do they think?"
 * FEELS quadrant should push for contradictions — people feel multiple things.
 *
 * Three interaction modes:
 *   1. "prompts"  — Generate research-depth prompts per quadrant
 *   2. "nudge"    — Specificity-focused effort-gated feedback
 *   3. "insights" — Cross-quadrant empathy synthesis at summary
 *
 * Uses Haiku 4.5 for speed. Short responses only.
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
  { name: "Says", emoji: "💬", focus: "direct quotes and statements the user makes out loud" },
  { name: "Thinks", emoji: "💭", focus: "private thoughts, beliefs, and assumptions they don't say out loud" },
  { name: "Does", emoji: "🏃", focus: "observable actions, behaviors, and habits" },
  { name: "Feels", emoji: "❤️", focus: "emotions, frustrations, hopes — including contradictory feelings" },
];

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

function buildPromptsSystemPrompt(quadIndex: number, ideaCount: number): string {
  const quad = QUADRANTS[quadIndex];

  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't added any observations yet.
- Start with accessible, concrete questions
- First question should be the easiest entry point for ${quad.focus}`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} observation(s).
- Avoid angles already explored
- Push toward less obvious aspects of ${quad.focus}`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} observations.
- Push for nuance, contradictions, edge cases
- Ask about specific moments, situations, or contexts`;
  }

  const quadRules: Record<string, string> = {
    Says: `QUADRANT RULES (Says — Direct Quotes):
- Push for ACTUAL WORDS and PHRASES the user would say — in their voice, not the student's
- Ask for specific quotes: "What exact words would they use when frustrated?"
- Push for quotes in different contexts: talking to friends, talking to authority, talking to themselves
- Good: "What would they literally say when this breaks?" Bad: "What do they think about it?"
- Encourage using quotation marks to capture authentic voice`,

    Thinks: `QUADRANT RULES (Thinks — Private Thoughts):
- Push for INTERNAL MONOLOGUE — what the user thinks but DOESN'T say out loud
- Ask about worries, hopes, assumptions, biases, and unspoken judgments
- Good: "What are they secretly worried about that they wouldn't admit?"
- Push for the GAP between what they SAY and what they THINK
- The interesting stuff is what they keep to themselves`,

    Does: `QUADRANT RULES (Does — Observable Actions):
- Push for SPECIFIC, OBSERVABLE BEHAVIORS — things you could see on camera
- Ask about routines, workarounds, habits, and coping strategies
- Good: "What's a specific workaround they use when the product fails?"
- Push for actions that reveal unspoken needs (what they DO vs what they SAY)
- Look for contradictions: do they SAY one thing but DO another?`,

    Feels: `QUADRANT RULES (Feels — Emotions):
- THIS IS THE RICHEST QUADRANT — push hard for depth
- People feel MULTIPLE, CONTRADICTORY emotions at once — push for this
- Good: "They might feel excited AND anxious about this — what else?"
- Ask about emotions in specific MOMENTS, not just general feelings
- Push past simple emotions (happy/sad) to nuanced ones (overwhelmed, validated, invisible, hopeful-but-skeptical)
- Good: "What emotion surprises even THEM?" Bad: "How do they feel?"`,
  };

  return `You are a design thinking mentor guiding a student through an Empathy Map exercise.

The student is working on the ${quad.emoji} ${quad.name} quadrant, which focuses on ${quad.focus}.

${quadRules[quad.name]}

${difficultyInstruction}

THIS IS A RESEARCH TOOL — depth and specificity are everything. Push for concrete, specific observations, not vague generalities.

YOUR ROLE: Generate 4 thought-provoking questions that help the student deeply understand their user.

RULES:
- Questions MUST stay within the ${quad.name} quadrant's domain
- Push for SPECIFICITY — "What exact words?" not "What do they say?"
- Reference specific aspects of their user/persona
- Never suggest the answer — only ask questions
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings. Nothing else.`;
}

// ─── Quadrant-Specific Nudge Generation ───

function buildNudgeSystemPrompt(quadIndex: number, effortLevel: "low" | "medium" | "high"): string {
  const quad = QUADRANTS[quadIndex];

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's observation is vague or surface-level.
- Push for specifics: what EXACT words/actions/feelings?
- The "acknowledgment" MUST be an empty string for low effort
- Ask them to describe a SPECIFIC moment or situation`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows some specificity.
- The "acknowledgment" should note ONE specific detail (3-8 words)
- Push for more context: when, where, in what situation?
- Ask about what's BEHIND the observation`,
    high: `EFFORT LEVEL: HIGH — The student has captured something specific and insightful.
- The "acknowledgment" should celebrate a SPECIFIC detail (3-8 words)
- Push for related observations they might have missed
- Ask about contradictions or surprises in this quadrant`,
  };

  const quadTone: Record<string, string> = {
    Says: "Push for MORE and DIFFERENT quotes. 'What would they say in a different context?' Help them capture authentic voice, not paraphrase.",
    Thinks: "Push for DEEPER and MORE PRIVATE thoughts. 'What worry do they keep completely hidden?' The most valuable thoughts are the ones people don't share.",
    Does: "Push for MORE SPECIFIC observable behaviors. 'What exactly do their hands do when they're frustrated?' The best observations are camera-ready.",
    Feels: "Push for CONTRADICTORY and NUANCED emotions. 'Could they also feel the opposite at the same time?' People rarely feel just one thing. This is the richest quadrant.",
  };

  return `You are an encouraging design thinking mentor. A student just added an observation to the ${quad.emoji} ${quad.name} quadrant of their Empathy Map.

${effortStrategy[effortLevel]}

${quadTone[quad.name]}

THIS IS A RESEARCH TOOL — depth and specificity are valued above all. Push for concrete details and nuanced understanding.

YOUR ROLE: Return a JSON object with your feedback.

RULES:
- "acknowledgment": 3-8 word note referencing their specific observation (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words, staying within the ${quad.name} quadrant
- Reference their specific observation — don't be generic
- Never suggest the answer in your question

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Great quote — very authentic!", "nudge": "What would they say when talking to someone they trust instead?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you quote their exact words in a specific situation?"}`;
}

// ─── Cross-Quadrant Insights ───

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete Empathy Map. They have observed their user from four angles: Says (direct quotes), Thinks (private thoughts), Does (observable actions), and Feels (emotions).

YOUR ROLE: Help the student see CONNECTIONS and CONTRADICTIONS across quadrants. The most valuable insights come from mismatches.

RULES:
- Identify 1-2 contradictions (e.g., "They SAY they love it but DO workarounds — why the gap?")
- Highlight the most empathetic observation — the one that shows deepest understanding
- If FEELS is thin, note that it's the richest quadrant and worth revisiting
- Ask 1 question about what this empathy map reveals about the user's deepest unmet need
- Be encouraging but push for depth
- Keep the whole response under 130 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC observations from their map

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "empathy-map", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    const persona = (body.persona as string) || "";

    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const stepIndex = (body.stepIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];
      const quad = QUADRANTS[Math.min(Math.max(stepIndex, 0), 3)];

      let userPrompt = `Design challenge: "${challenge}"
${persona ? `User/persona being mapped: "${persona}"` : ""}
Current quadrant: ${quad.emoji} ${quad.name} (${quad.focus})
${existingIdeas.length > 0 ? `Student's observations so far:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "No observations yet."}

Generate 4 questions for the ${quad.name} quadrant.`;

      const result = await callHaiku(buildPromptsSystemPrompt(stepIndex, existingIdeas.length), userPrompt, 300);

      const prompts = parseToolkitJSONArray(result.text) || [
        `What would they say about this?`,
        `What are they thinking privately?`,
        `What observable behavior reveals something?`,
        `What emotion comes up for them?`,
      ];

      logToolkitUsage("tools/empathy-map/prompts", result, { sessionId, stepIndex, action: "prompts" });
      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Specificity-focused effort-gated nudge ─── */
    if (action === "nudge") {
      const stepIndex = (body.stepIndex as number) ?? 0;
      const idea = body.idea as string;
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";
      const existingIdeas = (body.existingIdeas || []) as string[];

      if (!idea?.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const quad = QUADRANTS[Math.min(Math.max(stepIndex, 0), 3)];

      let userPrompt = `Design challenge: "${challenge}"
${persona ? `Persona: "${persona}"` : ""}
Quadrant: ${quad.emoji} ${quad.name}
Student's observation: "${idea}"
${existingIdeas.length > 0 ? `Other observations for this quadrant:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "First observation for this quadrant."}

Respond with JSON feedback.`;

      const result = await callHaiku(buildNudgeSystemPrompt(stepIndex, effortLevel), userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/empathy-map/nudge", result, { sessionId, stepIndex, action: "nudge", effortLevel });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Cross-quadrant insights ─── */
    if (action === "insights") {
      const allIdeas = body.allIdeas as string[][] | undefined;
      if (!allIdeas || !Array.isArray(allIdeas)) {
        return Response.json({ error: "Missing allIdeas" }, { status: 400 });
      }

      const ideaSummary = QUADRANTS.map((quad, i) => {
        const obs = allIdeas[i] || [];
        return `${quad.emoji} ${quad.name} (${quad.focus}):\n${obs.length > 0 ? obs.map((t, j) => `  ${j + 1}. ${t}`).join("\n") : "  (no observations)"}`;
      }).join("\n\n");

      let userPrompt = `Design challenge: "${challenge}"
${persona ? `Persona: "${persona}"` : ""}

The student's Empathy Map:
${ideaSummary}

Synthesize their empathy map across all four quadrants.`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 350);

      logToolkitUsage("tools/empathy-map/insights", result, { sessionId, action: "insights" });
      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("empathy-map", err);
  }
}
