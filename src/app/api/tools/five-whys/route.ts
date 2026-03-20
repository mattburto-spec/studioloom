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

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

const STEPS = [
  { label: "Why #1", emoji: "1️⃣", instruction: "Why does this problem exist? What's the first-level cause?" },
  { label: "Why #2", emoji: "2️⃣", instruction: "Why does that first cause happen? Go one layer deeper." },
  { label: "Why #3", emoji: "3️⃣", instruction: "Why does that second cause happen? Keep digging." },
  { label: "Why #4", emoji: "4️⃣", instruction: "Why does that third cause happen? You're getting close to the root." },
  { label: "Why #5", emoji: "5️⃣", instruction: "Why does that fourth cause happen? This should reveal the root cause." },
];

type ActionType = "prompts" | "nudge" | "insights";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  stepIndex?: number;
  idea?: string;
  existingIdeas?: string[];
  effortLevel?: "low" | "medium" | "high";
  allIdeas?: string[][];
  previousAnswers?: string[];
}

// ─── Prompt Generation ───

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
      `five-whys:${sessionId}`,
      TOOLKIT_LIMITS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Take a moment to think, then try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)) } }
      );
    }

    // ─── PROMPTS ───
    if (action === "prompts") {
      const stepIndex = body.stepIndex ?? 0;
      const existingIdeas = body.existingIdeas || [];
      const previousAnswers = body.previousAnswers || [];
      const step = STEPS[stepIndex];
      if (!step) {
        return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
      }

      const systemPrompt = buildPromptsSystemPrompt(stepIndex, existingIdeas.length, previousAnswers);
      const userPrompt = `Problem being analyzed: "${challenge}"
Current step: ${step.emoji} ${step.label}
${previousAnswers.length > 0 ? `Previous answers in the chain:\n${previousAnswers.map((a, i) => `  Why #${i + 1}: ${a}`).join("\n")}` : "This is the first Why."}
${existingIdeas.length > 0 ? `Student's current answers for this Why:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "No answers yet for this Why."}

Generate 4 probing questions for ${step.label}.`;

      const result = await callHaiku(systemPrompt, userPrompt, 300);

      logUsage({
        endpoint: "tools/five-whys/prompts",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, stepIndex, action: "prompts" },
      });

      try {
        const prompts = JSON.parse(result.text);
        if (Array.isArray(prompts) && prompts.length > 0) {
          return NextResponse.json({ prompts });
        }
      } catch {
        const match = result.text.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            const prompts = JSON.parse(match[0]);
            if (Array.isArray(prompts)) return NextResponse.json({ prompts });
          } catch { /* fall through */ }
        }
      }
      return NextResponse.json({ prompts: null });
    }

    // ─── NUDGE ───
    if (action === "nudge") {
      const { idea, stepIndex = 0, existingIdeas = [], effortLevel = "medium", previousAnswers = [] } = body;
      if (!idea?.trim()) {
        return NextResponse.json({ error: "Missing idea" }, { status: 400 });
      }
      const step = STEPS[stepIndex];
      if (!step) {
        return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(stepIndex, effortLevel, previousAnswers);
      const userPrompt = `Problem: "${challenge}"
Step: ${step.emoji} ${step.label}
${previousAnswers.length > 0 ? `Previous chain:\n${previousAnswers.map((a, i) => `  Why #${i + 1}: ${a}`).join("\n")}` : "First Why."}
Student's new answer: "${idea}"
${existingIdeas.length > 0 ? `Their other answers for this Why:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "This is their first answer for this Why."}

Respond with JSON feedback.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);

      logUsage({
        endpoint: "tools/five-whys/nudge",
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
      if (allIdeas.every((arr) => arr.length === 0)) {
        return NextResponse.json({ insights: "" });
      }

      const systemPrompt = buildInsightsSystemPrompt();
      const userPrompt = `Problem: "${challenge}"

The student's Five Whys chain:
${STEPS.map((step, i) => {
  const answers = allIdeas[i] || [];
  return `${step.emoji} ${step.label}:\n${answers.length > 0 ? answers.map((t, j) => `  ${j + 1}. ${t}`).join("\n") : "  (no answer)"}`;
}).join("\n\n")}

Analyze their causal chain and whether they reached a true root cause.`;

      const result = await callHaiku(systemPrompt, userPrompt, 350);

      logUsage({
        endpoint: "tools/five-whys/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, action: "insights" },
      });

      return NextResponse.json({ insights: result.text });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[five-whys] API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
