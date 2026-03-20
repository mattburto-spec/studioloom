/**
 * Mind Map Toolkit AI API
 *
 * Three Socratic interaction modes:
 *   1. "prompts"  — Generate contextual prompts for a mind map step (adaptive difficulty)
 *   2. "nudge"    — Effort-gated Socratic feedback after a student adds an idea
 *   3. "insights" — At the summary stage, find patterns and connections across all ideas
 *
 * Uses Haiku 4.5 for speed (student-facing).
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

// Rate limit: generous for toolkit (50/min per session, 500/hour)
const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

const MINDMAP_STEPS = [
  { step: 1, title: "Main Branches", desc: "brainstorming main topics or themes from the central concept" },
  { step: 2, title: "Sub-Branches", desc: "exploring each branch with specific sub-ideas and details" },
  { step: 3, title: "Connections", desc: "finding unexpected links and patterns between branches" },
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
}

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
  // For Mind Map: encourage DIVERGENT thinking and exploration
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
      `mind-map:${sessionId}`,
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
      if (stepIndex < 0 || stepIndex > 2) {
        return NextResponse.json({ error: "stepIndex must be 0-2" }, { status: 400 });
      }

      const step = MINDMAP_STEPS[stepIndex];
      const existingIdeas = body.existingIdeas || [];

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"

CURRENT MIND MAP STEP: Step ${step.step} — ${step.title} (${step.desc})`;

      if (existingIdeas.length > 0) {
        userPrompt += `\n\nIDEAS ALREADY GENERATED FOR THIS STEP:\n${existingIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}

Generate 4 NEW questions that push the student in DIFFERENT directions from their existing ideas. Don't repeat angles they've already explored.`;
      } else {
        userPrompt += `\n\nGenerate 4 thought-provoking questions specific to this challenge and this mind map step.`;
      }

      const result = await callHaiku(buildPromptsSystemPrompt(existingIdeas.length), userPrompt, 400);

      // Parse JSON array from response
      let prompts: string[];
      try {
        prompts = JSON.parse(result.text);
        if (!Array.isArray(prompts)) throw new Error("Not an array");
        prompts = prompts.slice(0, 4).map(p => String(p).trim());
      } catch {
        const matches = result.text.match(/"([^"]+)"/g);
        if (matches && matches.length >= 2) {
          prompts = matches.slice(0, 4).map(m => m.replace(/"/g, "").trim());
        } else {
          prompts = [
            `What are the main themes or categories related to "${challenge.trim()}"?`,
            `Who are the key people, groups, or systems involved?`,
            `What different perspectives or viewpoints exist on this topic?`,
            `What larger patterns or connections can you find?`,
          ];
        }
      }

      logUsage({
        endpoint: "tools/mind-map/prompts",
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

      const step = MINDMAP_STEPS[stepIndex ?? 0];
      const existingIdeas = body.existingIdeas || [];
      const effort = clientEffort || "medium";

      let userPrompt = `DESIGN CHALLENGE: "${challenge.trim()}"
MIND MAP STEP: Step ${step.step} — ${step.title}
IDEA JUST ADDED: "${idea.trim()}"`;

      if (existingIdeas.length > 1) {
        userPrompt += `\nOTHER IDEAS IN THIS STEP: ${existingIdeas.filter(i => i !== idea.trim()).join("; ")}`;
      }

      userPrompt += `\n\nReturn a JSON object with your acknowledgment and follow-up question.`;

      const result = await callHaiku(buildNudgeSystemPrompt(effort), userPrompt, 120);

      // Parse structured JSON response
      let nudgeText = result.text.trim();
      let acknowledgment = "";

      try {
        const jsonMatch = nudgeText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          nudgeText = parsed.nudge || nudgeText;
          acknowledgment = parsed.acknowledgment || "";
        }
      } catch {
        const nudgeMatch = nudgeText.match(/"nudge"\s*:\s*"([^"]+)"/);
        const ackMatch = nudgeText.match(/"acknowledgment"\s*:\s*"([^"]+)"/);
        if (nudgeMatch) nudgeText = nudgeMatch[1];
        if (ackMatch) acknowledgment = ackMatch[1];
      }

      logUsage({
        endpoint: "tools/mind-map/nudge",
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

      logUsage({
        endpoint: "tools/mind-map/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, totalIdeas, action: "insights" },
      });

      return NextResponse.json({ insights: result.text.trim() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[mind-map] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Mind Map tool error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
