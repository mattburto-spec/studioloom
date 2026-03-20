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
 * Uses Haiku 4.5 for speed. Short responses only.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

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

type ActionType = "nudge" | "insights";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  stepIndex?: number;
  idea?: string;
  natureSolutions?: string[];
  effortLevel?: "low" | "medium" | "high";
  allIdeas?: (string | null)[][];
}

// ─── Nudge Generation ───

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

// ─── Root Cause Insights ───

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

// ─── AI Call ───

async function callHaiku(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI service not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI call failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

  return {
    text: textBlock?.text || "",
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

// ─── Route Handler ───

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { action, challenge, sessionId } = body;

    if (!action || !challenge?.trim() || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: action, challenge, sessionId" },
        { status: 400 }
      );
    }

    const { allowed, retryAfterMs } = rateLimit(
      `biomimicry:${sessionId}`,
      TOOLKIT_LIMITS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Take a moment to think, then try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)) } }
      );
    }

    // ─── NUDGE ───
    if (action === "nudge") {
      const { stepIndex = 0, idea, natureSolutions = [], effortLevel = "medium" } = body;
      if (!idea?.trim()) {
        return NextResponse.json({ error: "Missing idea" }, { status: 400 });
      }

      const step = STEPS[stepIndex];
      if (!step) {
        return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(stepIndex, effortLevel);
      const userPrompt = `Challenge: "${challenge}"
Step ${stepIndex + 1}: ${step.label}
${natureSolutions.length > 0 ? `Previous nature observations:\n${natureSolutions.map((n, i) => `  ${i + 1}. ${n}`).join("\n")}` : ""}
Student's answer: "${idea}"

Respond with JSON feedback.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);

      logUsage({
        endpoint: "tools/biomimicry/nudge",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, stepIndex, effortLevel, action: "nudge" },
      });

      try {
        const parsed = JSON.parse(result.text);
        return NextResponse.json({
          nudge: parsed.nudge || result.text,
          acknowledgment: parsed.acknowledgment || "",
          effortLevel,
        });
      } catch {
        const nudgeMatch = result.text.match(/"nudge"\s*:\s*"([^"]+)"/);
        const ackMatch = result.text.match(/"acknowledgment"\s*:\s*"([^"]*)"/);
        return NextResponse.json({
          nudge: nudgeMatch?.[1] || result.text.replace(/[{}"\n]/g, "").trim(),
          acknowledgment: ackMatch?.[1] || "",
          effortLevel,
        });
      }
    }

    // ─── INSIGHTS ───
    if (action === "insights") {
      const { allIdeas = [] } = body;
      const hasIdeas = allIdeas.some((arr) => Array.isArray(arr) && arr.length > 0 && arr[0]);
      if (!hasIdeas) {
        return NextResponse.json({ insights: "" });
      }

      const systemPrompt = buildInsightsSystemPrompt();
      const ideaSummary = STEPS.map((step, i) => {
        const stepIdeas = allIdeas[i] || [];
        const idea = stepIdeas.length > 0 && stepIdeas[0] ? stepIdeas[0] : null;
        return `${step.label}: ${idea || "(not completed)"}`;
      }).join("\n");

      const userPrompt = `Challenge: "${challenge}"

Biomimicry journey:
${ideaSummary}

Analyze how the student translated their observation from nature into a design solution.`;

      const result = await callHaiku(systemPrompt, userPrompt, 350);

      logUsage({
        endpoint: "tools/biomimicry/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, action: "insights" },
      });

      return NextResponse.json({ insights: result.text });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[biomimicry] API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
