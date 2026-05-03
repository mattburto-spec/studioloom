// audit-skip: public anonymous free-tool, no actor identity
/**
 * Five Whys Toolkit AI API
 *
 * 5 steps: Why? × 5, drilling from problem to root cause.
 * KEY DIFFERENTIATOR: AI detects whether the student is going
 * SIDEWAYS (restating same level) or DEEPER (finding root cause).
 *
 * Three interaction modes:
 *   1. "prompts"  — Generate probing questions for the current "why" level
 *   2. "nudge"    — Depth-aware effort-gated feedback
 *   3. "insights" — Root cause synthesis at summary
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

const STEPS = [
  { label: "Why #1", emoji: "1️⃣", instruction: "Why does this problem exist? What's the first-level cause?" },
  { label: "Why #2", emoji: "2️⃣", instruction: "Why does that first cause happen? Go one layer deeper." },
  { label: "Why #3", emoji: "3️⃣", instruction: "Why does that second cause happen? Keep digging." },
  { label: "Why #4", emoji: "4️⃣", instruction: "Why does that third cause happen? You're getting close to the root." },
  { label: "Why #5", emoji: "5️⃣", instruction: "Why does that fourth cause happen? This should reveal the root cause." },
];

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

function buildPromptsSystemPrompt(stepIndex: number, ideaCount: number, previousAnswers: string[]): string {
  const step = STEPS[stepIndex];

  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written their answer for ${step.label} yet.
- Start with accessible questions that help them identify the cause at this level
- First question should be the easiest entry point`;
  } else if (ideaCount <= 1) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has started thinking. Push in new directions.
- Avoid repeating angles they've already explored
- Help them think about different types of causes (human, system, process, resource)`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has multiple answers. Challenge their thinking.
- Push for specificity and precision in their root cause analysis
- Ask about causes they might be overlooking or assuming away`;
  }

  const prevContext = previousAnswers.length > 0
    ? `CHAIN SO FAR:\n${previousAnswers.map((a, i) => `  Why #${i + 1}: ${a}`).join("\n")}\n\nThe student must now answer WHY the last answer (Why #${previousAnswers.length}) is true. Their new "why" must go DEEPER, not sideways.`
    : "This is the first Why — the student is identifying the first-level cause of their problem.";

  return `You are a design thinking mentor guiding a student through the Five Whys root cause analysis technique.

The student is on ${step.emoji} ${step.label}: "${step.instruction}"

${prevContext}

${difficultyInstruction}

THIS IS A ROOT CAUSE ANALYSIS TOOL. Your job is to help the student go DEEPER with each Why, not sideways.
- DEEPER = finding the underlying cause of the previous answer (moving toward root cause)
- SIDEWAYS = restating the same level of problem in different words (no new insight)

YOUR ROLE: Generate 4 probing questions that help the student identify a cause at this level.

RULES:
- Questions must help them find causes for their PREVIOUS answer specifically
- Push for concrete, specific causes — not vague "it just happens"
- Each question should approach from a different angle (human factors, system factors, process, resources, environment)
- Never suggest the answer — only ask questions
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings. Nothing else.`;
}

// ─── Depth-Aware Nudge Generation ───

function buildNudgeSystemPrompt(stepIndex: number, effortLevel: "low" | "medium" | "high", previousAnswers: string[]): string {
  const step = STEPS[stepIndex];

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague.
- Do NOT praise a vague answer — but stay warm
- Push for specifics: what exactly causes this? who is involved? what process fails?
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort.
- The "acknowledgment" should note ONE specific causal detail they identified (3-8 words)
- Push them to consider whether they've gone deeper or just sideways
- Ask about the mechanism: HOW does the previous cause lead to this one?`,
    high: `EFFORT LEVEL: HIGH — The student's response is specific and causal.
- The "acknowledgment" should celebrate their causal reasoning (3-8 words)
- Push for alternative causes or contributing factors at this level
- They're doing well — help them see if there's an even deeper cause`,
  };

  // Critical: detect sideways vs deeper
  const depthDetection = previousAnswers.length > 0
    ? `CRITICAL DEPTH CHECK: Compare the student's new answer to their previous answer(s):
${previousAnswers.map((a, i) => `  Why #${i + 1}: ${a}`).join("\n")}

If their new answer sounds like it's AT THE SAME LEVEL as the previous one (restating, rephrasing, or describing a consequence rather than a cause), your nudge should GENTLY point this out:
"That sounds like it might be at the same level as your previous answer — can you dig one layer deeper into WHY that happens?"

If they ARE going deeper (identifying an underlying cause), celebrate that and push further.`
    : "";

  return `You are an encouraging design thinking mentor. A student just added an answer for ${step.emoji} ${step.label} in their Five Whys analysis.

${effortStrategy[effortLevel]}

${depthDetection}

YOUR ROLE: Return a JSON object with your feedback. Help them drill DEEPER.

RULES:
- "acknowledgment": 3-8 word note referencing their specific answer (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- The nudge should help them go ONE LEVEL DEEPER (not sideways)
- Never suggest the answer in your question

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Good — you've identified a process gap!", "nudge": "What causes that process to break down in the first place?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you be more specific about what exactly causes that to happen?"}`;
}

// ─── Root Cause Insights ───

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete Five Whys analysis. They started with a problem and asked "Why?" five times to drill down to a root cause.

YOUR ROLE: Help the student see the CHAIN of causation and evaluate whether they reached a true root cause.

RULES:
- Trace the causal chain from the surface problem to their deepest answer
- Evaluate: did they genuinely reach a ROOT cause, or did they stop at a symptom?
- If they went sideways at any point (restated same level), note where the chain could be stronger
- Ask 1 question about what they could DO about the root cause they identified
- Be encouraging — Five Whys is hard and most people struggle with depth
- Keep the whole response under 130 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC answers from their chain

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "five-whys", ["prompts", "nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const stepIndex = (body.stepIndex as number) ?? 0;
      const existingIdeas = (body.existingIdeas || []) as string[];
      const previousAnswers = (body.previousAnswers || []) as string[];
      const step = STEPS[Math.min(Math.max(stepIndex, 0), 4)];

      let userPrompt = `Problem being analyzed: "${challenge}"
Current step: ${step.emoji} ${step.label}
${previousAnswers.length > 0 ? `Previous answers in the chain:\n${previousAnswers.map((a, i) => `  Why #${i + 1}: ${a}`).join("\n")}` : "This is the first Why."}
${existingIdeas.length > 0 ? `Student's current answers for this Why:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "No answers yet for this Why."}

Generate 4 probing questions for ${step.label}.`;

      const result = await callHaiku(buildPromptsSystemPrompt(stepIndex, existingIdeas.length, previousAnswers), userPrompt, 300);

      const prompts = parseToolkitJSONArray(result.text) || [
        `What exactly causes that?`,
        `Why does that happen?`,
        `What's the underlying reason for that?`,
        `Who or what is responsible for that?`,
      ];

      logToolkitUsage("tools/five-whys/prompts", result, { sessionId, stepIndex, action: "prompts" });
      return Response.json({ prompts: prompts.slice(0, 4) });
    }

    /* ─── Action: Depth-aware effort-gated nudge ─── */
    if (action === "nudge") {
      const stepIndex = (body.stepIndex as number) ?? 0;
      const idea = body.idea as string;
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";
      const existingIdeas = (body.existingIdeas || []) as string[];
      const previousAnswers = (body.previousAnswers || []) as string[];

      if (!idea?.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const step = STEPS[Math.min(Math.max(stepIndex, 0), 4)];

      let userPrompt = `Problem: "${challenge}"
Step: ${step.emoji} ${step.label}
${previousAnswers.length > 0 ? `Previous chain:\n${previousAnswers.map((a, i) => `  Why #${i + 1}: ${a}`).join("\n")}` : "First Why."}
Student's new answer: "${idea}"
${existingIdeas.length > 0 ? `Their other answers for this Why:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "This is their first answer for this Why."}

Respond with JSON feedback.`;

      const result = await callHaiku(buildNudgeSystemPrompt(stepIndex, effortLevel, previousAnswers), userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/five-whys/nudge", result, { sessionId, stepIndex, action: "nudge", effortLevel });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Root cause synthesis ─── */
    if (action === "insights") {
      const allIdeas = body.allIdeas as string[][] | undefined;
      if (!allIdeas || !Array.isArray(allIdeas)) {
        return Response.json({ error: "Missing allIdeas" }, { status: 400 });
      }

      const ideaSummary = STEPS.map((step, i) => {
        const answers = allIdeas[i] || [];
        return `${step.emoji} ${step.label}:\n${answers.length > 0 ? answers.map((t, j) => `  ${j + 1}. ${t}`).join("\n") : "  (no answer)"}`;
      }).join("\n\n");

      const userPrompt = `Problem: "${challenge}"

The student's Five Whys chain:
${ideaSummary}

Analyze their causal chain and whether they reached a true root cause.`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 350);

      logToolkitUsage("tools/five-whys/insights", result, { sessionId, action: "insights" });
      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("five-whys", err);
  }
}
