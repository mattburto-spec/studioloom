/**
 * Six Thinking Hats Toolkit AI API
 *
 * The KEY DIFFERENTIATOR: Each hat has its own AI feedback rules.
 * White = facts only, Red = emotions OK, Black = critical analysis OK,
 * Yellow = optimistic, Green = creative (divergent), Blue = process (meta).
 *
 * Three interaction modes:
 *   1. "prompts"  — Generate contextual prompts for the current hat
 *   2. "nudge"    — Hat-specific effort-gated Socratic feedback
 *   3. "insights" — Cross-hat patterns and synthesis at summary
 *
 * Uses Haiku 4.5 for speed. Short responses only — the student does the thinking.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

const HATS = [
  { color: "White", emoji: "⬜", focus: "facts, data, and information" },
  { color: "Red", emoji: "🟥", focus: "feelings, intuitions, and emotions" },
  { color: "Black", emoji: "⬛", focus: "risks, caution, and critical judgment" },
  { color: "Yellow", emoji: "🟨", focus: "benefits, optimism, and value" },
  { color: "Green", emoji: "🟩", focus: "creativity, new ideas, and alternatives" },
  { color: "Blue", emoji: "🟦", focus: "process, summary, and next steps" },
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

// ─── Hat-Specific Prompt Generation ───

function buildPromptsSystemPrompt(hatIndex: number, ideaCount: number): string {
  const hat = HATS[hatIndex];

  // Difficulty adapts to progress
  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written any thoughts yet for this hat.
- Start with accessible, concrete questions that connect to everyday experience
- First question should be the easiest entry point for ${hat.focus}
- Use tangible, specific language`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} thought(s). Push in new directions.
- Avoid angles already explored (see their existing thoughts below)
- Questions should push toward less obvious aspects of ${hat.focus}`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} thoughts. Push into unexplored territory.
- These prompts should open NEW directions within ${hat.focus}
- Push for surprising angles, unusual perspectives, unexpected connections`;
  }

  // Hat-specific rules — this is the magic
  const hatRules: Record<string, string> = {
    White: `HAT RULES (White — Information):
- Questions must ask for FACTS, DATA, and INFORMATION only
- Push for specificity: "What numbers do we have?" not "What do you think?"
- Ask about what is KNOWN vs what is UNKNOWN or ASSUMED
- Steer away from opinions or feelings — redirect to evidence
- Good: "What data would you need to check this?" Bad: "How do you feel about this?"`,

    Red: `HAT RULES (Red — Feelings):
- Questions must draw out EMOTIONS, INTUITIONS, and GUT REACTIONS
- Feelings don't need justification — "I just don't like it" is valid here
- Push for honesty: "What's your first reaction, before you think too hard?"
- Ask about different people's emotional responses too
- Good: "What excites you most about this?" Bad: "What are the facts?"`,

    Black: `HAT RULES (Black — Caution):
- Questions must identify RISKS, PROBLEMS, and WEAKNESSES
- This is where critical thinking belongs — ask about what could go wrong
- Push for specificity in risks: "What specific thing could fail?" not just "Any problems?"
- Ask about unintended consequences, edge cases, who it doesn't work for
- This is the ONE hat where "What could go wrong?" is encouraged
- Good: "What's the biggest risk here?" Bad: "What do you like about this?"`,

    Yellow: `HAT RULES (Yellow — Benefits):
- Questions must identify VALUE, BENEFITS, and OPPORTUNITIES
- Push for optimistic exploration — what's the BEST possible outcome?
- Ask about who benefits, what opportunities this creates, hidden advantages
- Challenge students to find value even in ideas they don't personally like
- Good: "What's the biggest opportunity here?" Bad: "What could go wrong?"`,

    Green: `HAT RULES (Green — Creativity):
- Questions must spark NEW IDEAS, ALTERNATIVES, and CREATIVE LEAPS
- This is pure ideation — encourage wild thinking, no evaluation
- Push for "what if" and "what else" and "imagine if"
- Ask about completely different approaches, not just tweaks
- Never ask about feasibility or problems — that's Black Hat's job
- Good: "What's the wildest alternative?" Bad: "Is that realistic?"`,

    Blue: `HAT RULES (Blue — Process):
- Questions must address the THINKING PROCESS itself — what have we learned?
- Push for META-REFLECTION: "Looking at all your hats, what patterns do you see?"
- Ask about what's missing from their thinking, what hat they should revisit
- Help them synthesize and plan next steps
- Good: "Which hat revealed the most surprising insights?" Bad: "What's your gut feeling?"`,
  };

  return `You are a design thinking mentor guiding a student through the Six Thinking Hats technique.

The student is currently wearing the ${hat.emoji} ${hat.color} Hat, which focuses on ${hat.focus}.

${hatRules[hat.color]}

${difficultyInstruction}

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the student's design challenge AND appropriate for the ${hat.color} Hat. Questions should make the student think within the hat's perspective.

RULES:
- Questions MUST stay within the ${hat.color} Hat's domain — don't mix hat perspectives
- Reference specific aspects of their actual design challenge
- Never suggest specific solutions or ideas — only ask questions
- Each question should approach from a different angle within the hat
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings. Nothing else.`;
}

// ─── Hat-Specific Nudge Generation ───

function buildNudgeSystemPrompt(hatIndex: number, effortLevel: "low" | "medium" | "high"): string {
  const hat = HATS[hatIndex];

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague. Encourage them to go deeper within the ${hat.color} Hat's focus.
- Do NOT praise a vague thought — but stay warm and encouraging
- Ask them to be more specific WITHIN the hat's domain (${hat.focus})
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Build on their momentum.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Encourage them to push further within the ${hat.color} Hat — what else can they see from this perspective?
- Ask "what else" or "what about [unexplored angle within this hat]?"`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and specific. Fuel their thinking.
- The "acknowledgment" should celebrate a SPECIFIC detail from their thought (3-8 words)
- Push for additional angles WITHIN the ${hat.color} Hat that they haven't covered yet
- Encourage them to keep going — they're thinking well from this perspective`,
  };

  // Hat-specific nudge tone
  const hatTone: Record<string, string> = {
    White: "Your nudge should steer toward MORE facts, data, and evidence. If the student drifts into opinion, gently redirect: 'That's interesting — what data would support or contradict that?'",
    Red: "Your nudge should draw out MORE feelings and intuitions. Feelings don't need justification here. Encourage honesty: 'What other emotions come up when you think about this?'",
    Black: "Your nudge should push for MORE risks and concerns. This is the hat for critical thinking. Encourage specificity: 'What specific thing makes you most worried?'",
    Yellow: "Your nudge should push for MORE benefits and opportunities. Stay optimistic. Encourage value-finding: 'What's another unexpected advantage?'",
    Green: "Your nudge should spark MORE creative ideas. Pure divergent thinking — no evaluation. Encourage wild ideas: 'What's the most unusual version of that?' Never critique ideas here.",
    Blue: "Your nudge should push for META-REFLECTION on the thinking process. What patterns have emerged? What's been overlooked? 'What hat do you think you should spend more time on?'",
  };

  return `You are an encouraging design thinking mentor. A student just added a thought while wearing the ${hat.emoji} ${hat.color} Hat (${hat.focus}) during a Six Thinking Hats session.

${effortStrategy[effortLevel]}

${hatTone[hat.color]}

CRITICAL: Stay within the ${hat.color} Hat's domain. Do NOT mix hat perspectives in your nudge.

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive.

RULES:
- "acknowledgment": 3-8 word note referencing their specific thought (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words, staying within the ${hat.color} Hat
- Reference their specific thought — don't be generic
- Never suggest the answer in your question

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Great point about the survey data!", "nudge": "What other data sources could you check to verify that?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you give a specific example of what data you'd look for?"}`;
}

// ─── Cross-Hat Insights ───

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete Six Thinking Hats session. They have examined a design challenge from six different perspectives: facts (White), feelings (Red), risks (Black), benefits (Yellow), creativity (Green), and process (Blue).

YOUR ROLE: Help the student see how the six perspectives CONNECT and CONTRAST. This is about synthesis across viewpoints.

RULES:
- Identify 2-3 tensions or connections between different hats (e.g., "Your Red Hat excitement about X contrasts with your Black Hat concern about Y")
- Note which hat generated the richest thinking and which might deserve more time
- Ask 1-2 provocative questions about what their next step should be
- Be encouraging but honest — if one hat was thin, suggest revisiting it
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC thoughts from their session, not generalities

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

    // Rate limit
    const { allowed, retryAfterMs } = rateLimit(
      `six-hats:${sessionId}`,
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
      const hat = HATS[stepIndex];
      if (!hat) {
        return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
      }

      const systemPrompt = buildPromptsSystemPrompt(stepIndex, existingIdeas.length);
      const userPrompt = `Design challenge: "${challenge}"
Current hat: ${hat.emoji} ${hat.color} Hat (${hat.focus})
${existingIdeas.length > 0 ? `Student's existing thoughts for this hat:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "No thoughts yet for this hat."}

Generate 4 questions for the ${hat.color} Hat.`;

      const result = await callHaiku(systemPrompt, userPrompt, 300);

      // Log usage (fire-and-forget)
      logUsage({
        endpoint: "tools/six-hats/prompts",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, stepIndex, action: "prompts" },
      });

      // Parse JSON array
      try {
        const prompts = JSON.parse(result.text);
        if (Array.isArray(prompts) && prompts.length > 0) {
          return NextResponse.json({ prompts });
        }
      } catch {
        // Try extracting array from text
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
      const { idea, stepIndex = 0, existingIdeas = [], effortLevel = "medium" } = body;
      if (!idea?.trim()) {
        return NextResponse.json({ error: "Missing idea" }, { status: 400 });
      }
      const hat = HATS[stepIndex];
      if (!hat) {
        return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(stepIndex, effortLevel);
      const userPrompt = `Design challenge: "${challenge}"
Current hat: ${hat.emoji} ${hat.color} Hat (${hat.focus})
Student's new thought: "${idea}"
${existingIdeas.length > 0 ? `Their other thoughts for this hat:\n${existingIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "This is their first thought for this hat."}

Respond with your JSON feedback for the ${hat.color} Hat.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);

      logUsage({
        endpoint: "tools/six-hats/nudge",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, stepIndex, effortLevel, action: "nudge" },
      });

      // Parse structured response
      try {
        const parsed = JSON.parse(result.text);
        return NextResponse.json({
          nudge: parsed.nudge || result.text,
          acknowledgment: parsed.acknowledgment || "",
          effortLevel,
        });
      } catch {
        // Regex fallback
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
      const userPrompt = `Design challenge: "${challenge}"

The student's Six Thinking Hats session:
${HATS.map((hat, i) => {
  const thoughts = allIdeas[i] || [];
  return `${hat.emoji} ${hat.color} Hat (${hat.focus}):\n${thoughts.length > 0 ? thoughts.map((t, j) => `  ${j + 1}. ${t}`).join("\n") : "  (no thoughts recorded)"}`;
}).join("\n\n")}

Synthesize their thinking across all six hats.`;

      const result = await callHaiku(systemPrompt, userPrompt, 400);

      logUsage({
        endpoint: "tools/six-hats/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, action: "insights" },
      });

      return NextResponse.json({ insights: result.text });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[six-hats] API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
