// audit-skip: public anonymous free-tool, no actor identity
/**
 * Biomimicry Cards Toolkit AI API
 *
 * 4-step nature-inspired ideation:
 *   1. Observe Nature — what organism solves this?
 *   2. Extract Principle — what's the underlying strategy?
 *   3. Apply to Design — translate principle into solution
 *   4. Evaluate Fit — how feasible is this?
 *
 * Two interaction modes:
 *   1. "nudge"    — Per-step effort-gated feedback
 *   2. "insights" — Synthesis of nature pipeline into design solutions
 *
 * Uses shared toolkit helpers — see src/lib/toolkit/shared-api.ts
 */

import { NextRequest } from "next/server";
import {
  callHaiku,
  validateToolkitRequest,
  parseToolkitJSON,
  logToolkitUsage,
  toolkitErrorResponse,
} from "@/lib/toolkit";

// ─── Tool-specific config ───

const STEPS = [
  {
    label: "Observe Nature",
    rules: "organisms, natural systems, ecosystems that solve similar problems across all scales",
  },
  {
    label: "Extract Principle",
    rules: "underlying strategy, mechanism, structure, or process — the WHY behind how nature solves this",
  },
  {
    label: "Apply to Design",
    rules: "specific, concrete design solution using materials, shapes, mechanisms — how to implement the principle",
  },
  {
    label: "Evaluate Fit",
    rules: "feasibility, cost, materials, manufacturing, user needs, trade-offs — is this practical?",
  },
];

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

function buildNudgeSystemPrompt(
  stepIndex: number,
  effortLevel: "low" | "medium" | "high"
): string {
  const step = STEPS[stepIndex];

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague.
- Do NOT praise a vague answer — but stay warm
- Push for specifics: exactly what, exactly how?
- The "nudge" should ask them to be more concrete`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort.
- The "acknowledgment" should note ONE specific detail they mentioned (3-8 words)
- Push deeper: what else could they explore in this step?
- Encourage specificity and concrete thinking`,
    high: `EFFORT LEVEL: HIGH — The student's response is specific and thoughtful.
- The "acknowledgment" should celebrate their thinking (3-8 words)
- Push for alternative angles or deeper exploration
- They're thinking well — help them see new possibilities`,
  };

  const stepContext = `Step ${stepIndex + 1}: ${step.label}
Consider: ${step.rules}`;

  return `You are a biomimicry mentor guiding a student through nature-inspired design ideation.

${stepContext}

${effortStrategy[effortLevel]}

THIS IS CREATIVE IDEATION. Your job is to help them think DEEPLY and SPECIFICALLY about nature's solutions and how to translate them.

YOUR ROLE: Return a JSON object with your feedback.

RULES:
- "acknowledgment": 3-8 word note referencing their specific answer (empty string for low effort)
- "nudge": ONE follow-up question, maximum 20 words
- The nudge should help them go DEEPER into this step
- Never suggest the answer — only ask questions that deepen thinking

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Good — spider webs!", "nudge": "What makes their design so efficient at handling stress?"}

For low effort:
{"acknowledgment": "", "nudge": "What specifically about this organism or system solves your problem?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete biomimicry card journey.

The student worked through 4 steps: (1) Observe Nature, (2) Extract Principle, (3) Apply to Design, (4) Evaluate Fit.

YOUR ROLE: Help them see the PIPELINE from nature observation to design solution, and highlight the strongest insight.

RULES:
- Trace their thinking from the natural example → principle → design application → feasibility
- Which step shows the strongest insight? What's their best nature-to-design translation?
- Are there any places where the principle got lost or where they could strengthen the translation?
- Ask ONE question about how they could TEST or PROTOTYPE this idea
- Be encouraging — biomimicry requires sophisticated thinking and they did good work
- Keep the whole response under 130 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC examples from their pipeline (the organism, the principle, the application)

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "biomimicry", ["nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Nudge feedback ─── */
    if (action === "nudge") {
      const { stepIndex = 0, idea, natureSolutions = [], effortLevel = "medium" } = body;
      if (!(idea as string)?.trim()) {
        return Response.json({ error: "Missing idea" }, { status: 400 });
      }

      const step = STEPS[stepIndex as number];
      if (!step) {
        return Response.json({ error: "Invalid step index" }, { status: 400 });
      }

      const userPrompt = `Challenge: "${challenge}"
Step ${(stepIndex as number) + 1}: ${step.label}
${(natureSolutions as string[]).length > 0 ? `Previous nature observations:\n${(natureSolutions as string[]).map((n, i) => `  ${i + 1}. ${n}`).join("\n")}` : ""}
Student's answer: "${(idea as string).trim()}"

Respond with JSON feedback.`;

      const result = await callHaiku(
        buildNudgeSystemPrompt(stepIndex as number, effortLevel as "low" | "medium" | "high"),
        userPrompt,
        120
      );
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/biomimicry/nudge", result, {
        sessionId,
        stepIndex,
        effortLevel,
        action: "nudge",
      });

      return Response.json({
        nudge: parsed.nudge || result.text,
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Insights synthesis ─── */
    if (action === "insights") {
      const { allIdeas = [] } = body;
      const hasIdeas = (allIdeas as (string | null)[][]).some(
        (arr) => Array.isArray(arr) && arr.length > 0 && arr[0]
      );
      if (!hasIdeas) {
        return Response.json({ insights: "" });
      }

      const ideaSummary = STEPS.map((step, i) => {
        const stepIdeas = (allIdeas as (string | null)[][])[i] || [];
        const idea = stepIdeas.length > 0 && stepIdeas[0] ? stepIdeas[0] : null;
        return `${step.label}: ${idea || "(not completed)"}`;
      }).join("\n");

      const userPrompt = `Challenge: "${challenge}"

Biomimicry journey:
${ideaSummary}

Analyze how the student translated their observation from nature into a design solution.`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 350);

      logToolkitUsage("tools/biomimicry/insights", result, { sessionId, action: "insights" });

      return Response.json({ insights: result.text });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("biomimicry", err);
  }
}
