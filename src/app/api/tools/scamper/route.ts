/**
 * SCAMPER Toolkit AI API
 *
 * Three Socratic interaction modes:
 *   1. "prompts"  — Generate contextual prompts for a SCAMPER step (adaptive difficulty)
 *   2. "nudge"    — Effort-gated Socratic feedback after a student adds an idea
 *   3. "insights" — At the summary stage, find connections and themes across all ideas
 *
 * Education AI patterns (better than Khanmigo/Duolingo):
 *   - Effort-gating: assess response quality before choosing feedback strategy
 *   - Socratic feedback: acknowledge → ask a question targeting the gap
 *   - Staged cognitive load: adapt prompt difficulty to student progress
 *   - Micro-feedback: immediate specific acknowledgment + progress indicators
 *
 * Uses Haiku 4.5 for speed (student-facing). Short responses only — the student does the thinking.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

// Rate limit: generous for toolkit (50/min per session, 500/hour)
const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

const SCAMPER_STEPS = [
  { letter: "S", word: "Substitute", verb: "substituting components, materials, people, or processes" },
  { letter: "C", word: "Combine", verb: "merging ideas, features, or elements together" },
  { letter: "A", word: "Adapt", verb: "borrowing or adapting ideas from elsewhere" },
  { letter: "M", word: "Modify", verb: "changing size, shape, colour, or form" },
  { letter: "P", word: "Put to other use", verb: "finding new contexts or users for this" },
  { letter: "E", word: "Eliminate", verb: "removing, simplifying, or reducing" },
  { letter: "R", word: "Reverse", verb: "reversing, inverting, or doing the opposite" },
];

type ActionType = "prompts" | "nudge" | "insights";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  // For "prompts": which step index (0-6)
  stepIndex?: number;
  // For "nudge": the idea just added + existing ideas for this step
  idea?: string;
  existingIdeas?: string[];
  // For "nudge": client-assessed effort level (enables effort-gated feedback)
  effortLevel?: "low" | "medium" | "high";
  // For "insights": all ideas grouped by step
  allIdeas?: string[][];
}

function buildPromptsSystemPrompt(ideaCount: number): string {
  // Staged cognitive load: adapt prompt difficulty to student progress
  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written any ideas yet for this step.
- Start with accessible, concrete questions that connect to everyday experience
- First question should be the easiest entry point possible
- Gradually increase complexity across the 4 questions
- Use tangible examples in the questions ("What if you used wood instead of plastic?")`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} idea(s). Push in new directions.
- Avoid angles the student has already explored (see their existing ideas below)
- Questions should push toward less obvious aspects: edge cases, different users, different contexts
- Mix one "what if" question with one "who else" and one "what assumption" question`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} ideas. Push into creative territory they haven't explored.
- These prompts should open NEW creative directions: different contexts, scales, users, eras, cultures
- Push for wild ideas: "What if this had to work underwater?" or "What would this look like in 100 years?"
- Include one question that combines this SCAMPER step with a different one
- Go for unexpected angles — surprise them into thinking differently`;
  }

  return `You are a design thinking mentor helping a student brainstorm using the SCAMPER technique.

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the student's design challenge and the current SCAMPER step. Questions should make the student think — not give them answers.

${difficultyInstruction}

RULES:
- Questions MUST reference specific aspects of their actual design challenge (materials, users, context, etc.)
- Never suggest specific solutions or ideas — only ask questions that unlock thinking
- Each question should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings, each a question. Nothing else.
Example: ["What if you replaced the main material with something from nature?", "Who else might face a similar problem in a completely different setting?", "Could you swap the order of how someone uses this?", "What part feels most 'fixed' — and what would happen if you changed exactly that?"]`;
}

function buildNudgeSystemPrompt(effortLevel: "low" | "medium" | "high"): string {
  // IDEATION PHASE: encourage divergent thinking, NOT critical evaluation.
  // Save "what could go wrong?" and "who does this fail for?" for evaluation tools.
  // Here we want FLOW — more ideas, wilder ideas, building on momentum.
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague. Encourage them to flesh it out.
- Do NOT praise a vague idea — but stay warm and encouraging
- Ask them to paint the picture: what does it look like, feel like, who would use it?
- Nudge for specifics that EXPAND the idea, not critique it
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Build on their momentum.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Encourage them to push the idea FURTHER: bigger, wilder, more creative
- Ask "what if you took that even further?" or "what else could that lead to?"
- Spark adjacent ideas: "what would a completely different version of this look like?"`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and specific. Fuel their creative momentum.
- The "acknowledgment" should celebrate a SPECIFIC detail from their idea (3-8 words)
- Encourage them to branch out: what RELATED ideas does this spark?
- Ask about variations, spin-offs, or unexpected combinations with their other ideas
- Push for creative leaps: "what's the wildest version of this?" or "what if you combined this with [their earlier idea]?"`,
  };

  return `You are an encouraging design thinking mentor. A student just added an idea during a SCAMPER brainstorming session.

THIS IS IDEATION — your job is to keep creative momentum flowing, NOT to evaluate or critique ideas.
Never ask about flaws, feasibility, trade-offs, or what could go wrong. That belongs in evaluation, not here.
Your questions should help the student generate MORE ideas and EXPAND on existing ones.

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive and generative.

RULES:
- "acknowledgment": 3-8 word note referencing their specific idea (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- The question must ENCOURAGE more ideas or EXPAND on the current one
- Never critique, evaluate, or ask about problems with the idea
- Reference their specific idea — don't be generic
- Vary your approach — try "what if", "what else", "how about", "imagine if"

RESPONSE FORMAT: Return ONLY a JSON object, nothing else:
{"acknowledgment": "Love the foldable handle idea!", "nudge": "What if you made it work for a completely different age group too?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you describe what it looks like — shape, material, how someone holds it?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete SCAMPER brainstorming session.

YOUR ROLE: Help the student see PATTERNS and CONNECTIONS across their ideas that they might not have noticed. This is about synthesis, not judgment.

RULES:
- Identify 2-3 themes or patterns that appear across multiple SCAMPER steps
- Point out unexpected connections between ideas from different steps
- Ask 1-2 provocative questions about which ideas could be combined or developed further
- Be encouraging but intellectually honest — if ideas cluster in one direction, note what's missing
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Never tell them which idea is "best" — help them see the landscape of their thinking

RESPONSE FORMAT: 2-3 short paragraphs of plain text. Use no headers, no bullets, no markdown.`;
}

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { action, challenge, sessionId } = body;

    // Validate
    if (!action || !challenge?.trim() || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: action, challenge, sessionId" },
        { status: 400 }
      );
    }

    if (!["prompts", "nudge", "insights"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be: prompts, nudge, or insights" },
        { status: 400 }
      );
    }

    // Rate limit by session
    const { allowed, retryAfterMs } = rateLimit(
      `scamper:${sessionId}`,
      TOOLKIT_LIMITS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Take a breath and try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)) } }
      );
    }

    /* ─── Action: Generate contextual prompts ─── */
    if (action === "prompts") {
      const stepIndex = body.stepIndex ?? 0;
      if (stepIndex < 0 || stepIndex > 6) {
        return NextResponse.json({ error: "stepIndex must be 0-6" }, { status: 400 });
      }

      const step = SCAMPER_STEPS[stepIndex];
      const existingIdeas = body.existingIdeas || [];

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

CURRENT SCAMPER STEP: ${step.letter} — ${step.word} (${step.verb})`;

      if (existingIdeas.length > 0) {
        userPrompt += `\n\nIDEAS ALREADY GENERATED FOR THIS STEP:\n${existingIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}

Generate 4 NEW questions that push the student in DIFFERENT directions from their existing ideas. Don't repeat angles they've already explored.`;
      } else {
        userPrompt += `\n\nGenerate 4 thought-provoking questions specific to this challenge and this SCAMPER step.`;
      }

      const result = await callHaiku(buildPromptsSystemPrompt(existingIdeas.length), userPrompt, 400);

      // Parse JSON array from response
      let prompts: string[];
      try {
        prompts = JSON.parse(result.text);
        if (!Array.isArray(prompts)) throw new Error("Not an array");
        prompts = prompts.slice(0, 4).map(p => String(p).trim());
      } catch {
        // Fallback: try to extract from text
        const matches = result.text.match(/"([^"]+)"/g);
        if (matches && matches.length >= 2) {
          prompts = matches.slice(0, 4).map(m => m.replace(/"/g, "").trim());
        } else {
          prompts = [
            `What would happen if you changed the most obvious part of your ${step.word.toLowerCase()} approach?`,
            `Think about who uses this — how might ${step.verb} change their experience?`,
            `What assumption are you making that might not be true?`,
            `If a student from a completely different country faced this challenge, what would they ${step.word.toLowerCase()}?`,
          ];
        }
      }

      logUsage({
        endpoint: "tools/scamper/prompts",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, stepIndex, action: "prompts" },
      });

      return NextResponse.json({ prompts });
    }

    /* ─── Action: Effort-gated Socratic nudge ─── */
    if (action === "nudge") {
      const { idea, stepIndex, effortLevel: clientEffort } = body;
      if (!idea?.trim()) {
        return NextResponse.json({ error: "Missing idea" }, { status: 400 });
      }

      const step = SCAMPER_STEPS[stepIndex ?? 0];
      const existingIdeas = body.existingIdeas || [];
      const effort = clientEffort || "medium";

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"
SCAMPER STEP: ${step.letter} — ${step.word}
IDEA JUST ADDED: "${idea.trim()}"`;

      if (existingIdeas.length > 1) {
        userPrompt += `\nOTHER IDEAS IN THIS STEP: ${existingIdeas.filter(i => i !== idea.trim()).join("; ")}`;
      }

      userPrompt += `\n\nReturn a JSON object with your acknowledgment and follow-up question.`;

      const result = await callHaiku(buildNudgeSystemPrompt(effort), userPrompt, 120);

      // Parse structured JSON response (with fallback for plain text)
      let nudgeText = result.text.trim();
      let acknowledgment = "";

      try {
        // Try to extract JSON from the response (may be wrapped in markdown)
        const jsonMatch = nudgeText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          nudgeText = parsed.nudge || nudgeText;
          acknowledgment = parsed.acknowledgment || "";
        }
      } catch {
        // Fallback: try regex extraction from malformed JSON
        const nudgeMatch = nudgeText.match(/"nudge"\s*:\s*"([^"]+)"/);
        const ackMatch = nudgeText.match(/"acknowledgment"\s*:\s*"([^"]+)"/);
        if (nudgeMatch) nudgeText = nudgeMatch[1];
        if (ackMatch) acknowledgment = ackMatch[1];
      }

      logUsage({
        endpoint: "tools/scamper/nudge",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, stepIndex, action: "nudge", effortLevel: effort },
      });

      return NextResponse.json({
        nudge: nudgeText,
        acknowledgment,
        effortLevel: effort,
      });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const { allIdeas } = body;
      if (!allIdeas || !Array.isArray(allIdeas)) {
        return NextResponse.json({ error: "Missing allIdeas" }, { status: 400 });
      }

      // Build a readable summary of all ideas
      const ideaSummary = SCAMPER_STEPS.map((step, i) => {
        const ideas = allIdeas[i] || [];
        if (ideas.length === 0) return `${step.letter} (${step.word}): No ideas`;
        return `${step.letter} (${step.word}):\n${ideas.map((idea, j) => `  ${j + 1}. ${idea}`).join("\n")}`;
      }).join("\n\n");

      const totalIdeas = allIdeas.reduce((sum, arr) => sum + arr.length, 0);

      const userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

ALL SCAMPER IDEAS (${totalIdeas} total):
${ideaSummary}

Help the student see patterns and connections across their ideas. What themes emerge? What unexpected links exist between ideas from different steps? What directions might be worth developing further?`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 300);

      logUsage({
        endpoint: "tools/scamper/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, totalIdeas, action: "insights" },
      });

      return NextResponse.json({ insights: result.text.trim() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[scamper] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `SCAMPER tool error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
