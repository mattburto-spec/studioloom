/**
 * SWOT Analysis Toolkit AI API
 *
 * Four quadrants: Strengths, Weaknesses, Opportunities, Threats.
 * KEY: This is an EVALUATION/ANALYSIS tool — convergent, analytical thinking is correct here.
 *
 * Three interaction modes:
 *   1. "prompts"  — Generate analytical questions for the current quadrant
 *   2. "nudge"    — Effort-gated Socratic feedback per quadrant
 *   3. "insights" — Cross-quadrant synthesis at summary
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

const QUADRANTS = [
  { name: "Strengths", focus: "internal positive attributes" },
  { name: "Weaknesses", focus: "internal negative attributes" },
  { name: "Opportunities", focus: "external positive factors" },
  { name: "Threats", focus: "external negative factors" },
];

type ActionType = "prompts" | "nudge" | "insights";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  quadrantIndex?: number;
  idea?: string;
  existingIdeas?: string[];
  effortLevel?: "low" | "medium" | "high";
  allIdeas?: string[][];
}

// ─── Quadrant-Specific Prompt Generation ───

function buildPromptsSystemPrompt(quadIndex: number, ideaCount: number): string {
  const quad = QUADRANTS[quadIndex];

  let difficultyInstruction: string;
  if (ideaCount === 0) {
    difficultyInstruction = `DIFFICULTY: INTRODUCTORY — The student hasn't written anything yet for this quadrant.
- Start with accessible, concrete questions that connect to everyday experience
- First question should be the easiest entry point for ${quad.focus}
- Use tangible, specific language`;
  } else if (ideaCount <= 2) {
    difficultyInstruction = `DIFFICULTY: BUILDING — The student has ${ideaCount} point(s). Push in new directions.
- Avoid angles already explored (see their existing points below)
- Questions should push toward less obvious aspects of ${quad.focus}`;
  } else {
    difficultyInstruction = `DIFFICULTY: ADVANCED — The student has ${ideaCount} points. Push into unexplored territory.
- These prompts should open NEW analytical angles within ${quad.focus}
- Push for surprising considerations, stakeholders they haven't thought about, edge cases`;
  }

  // Quadrant-specific rules
  const quadRules: Record<string, string> = {
    Strengths: `QUADRANT RULES (Strengths — Internal Positive):
- Questions must help the student identify REAL STRENGTHS, CAPABILITIES, and COMPETITIVE ADVANTAGES
- Push for specificity and evidence: "What skills do you have that competitors don't?" not just "What are you good at?"
- Ask about different types of strengths: skills, resources, reputation, team, partnerships
- Encourage finding strengths that aren't immediately obvious
- Help them see how strengths can be leveraged
- Good: "What specific capability would be hard for someone else to copy?"
- Bad: "What's weak about this?"`,

    Weaknesses: `QUADRANT RULES (Weaknesses — Internal Negative):
- Questions must help the student identify HONEST WEAKNESSES, LIMITATIONS, and AREAS FOR IMPROVEMENT
- Push for specificity without being discouraging: "What skill gap would limit you?" not just "Any weaknesses?"
- Ask about different types of weaknesses: skills, resources, inexperience, processes, team gaps
- Encourage candid self-assessment — this is where real insight happens
- Help them distinguish between "we don't have that resource yet" vs. "we can't do that"
- Good: "What would be hardest for you to do with your current resources?"
- Bad: "What's good about this?"`,

    Opportunities: `QUADRANT RULES (Opportunities — External Positive):
- Questions must help the student identify EXTERNAL OPPORTUNITIES, MARKET GAPS, and FAVORABLE CONDITIONS
- Push for specificity about timing, context, and conditions: "What trend in the next 2 years could help?" not just "Any opportunities?"
- Ask about different sources: market trends, technology, partnerships, regulatory changes, emerging user needs
- Encourage finding opportunities that might not be obvious yet
- Help them think about "if X happens, what becomes possible?"
- Good: "What new market or user group could emerge that would benefit from your solution?"
- Bad: "What could go wrong?" (that's Threats)`,

    Threats: `QUADRANT RULES (Threats — External Negative):
- Questions must help the student identify REALISTIC EXTERNAL THREATS, RISKS, and UNFAVORABLE CONDITIONS
- Push for specificity about what could actually go wrong: "Which competitor move would hurt most?" not just "Any risks?"
- Ask about different sources: competitors, market changes, regulations, technology shifts, economic factors
- Encourage realistic risk assessment — neither catastrophizing nor dismissing real risks
- Help them distinguish between "unlikely but catastrophic" vs. "likely and manageable"
- Good: "What external change could make your solution less valuable?"
- Bad: "What's good about this?" (that's Opportunities)`,
  };

  return `You are a design thinking mentor guiding a student through a SWOT Analysis.

The student is currently working on the ${quad.name} quadrant, which focuses on ${quad.focus}.

${quadRules[quad.name]}

${difficultyInstruction}

THIS IS AN ANALYSIS TOOL — convergent, analytical thinking is correct here. Unlike brainstorming tools, you SHOULD ask about trade-offs, feasibility, risks, and real-world implications.

YOUR ROLE: Generate 4 thought-provoking questions that are SPECIFIC to the student's design challenge AND appropriate for the ${quad.name} quadrant.

RULES:
- Questions MUST stay within the ${quad.name} quadrant's domain
- Reference specific aspects of their actual design challenge
- Never suggest specific answers — only ask questions
- Each question should approach from a different angle
- Use simple, clear language suitable for ages 11-18
- Keep each question to 1-2 sentences max

RESPONSE FORMAT: Return a JSON array of exactly 4 strings. Nothing else.`;
}

// ─── Quadrant-Specific Nudge Generation ───

function buildNudgeSystemPrompt(quadIndex: number, effortLevel: "low" | "medium" | "high"): string {
  const quad = QUADRANTS[quadIndex];

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague. Push for specifics.
- Do NOT praise a vague point — but stay warm and encouraging
- Ask them to be more specific: who, what, when, how, for whom?
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort. Deepen their analysis.
- The "acknowledgment" should note ONE specific detail they included (3-8 words)
- Push them to consider a specific stakeholder, context, or scenario they missed
- Ask "who else might be affected?" or "what about in a different context?"`,
    high: `EFFORT LEVEL: HIGH — The student's response is detailed and analytical. Challenge further.
- The "acknowledgment" should celebrate a SPECIFIC analytical detail (3-8 words)
- Push for second-order effects, trade-offs, or implications they haven't covered
- This student can handle harder follow-ups`,
  };

  const quadTone: Record<string, string> = {
    Strengths:
      "Your nudge should push for MORE SPECIFIC strengths and ask how they can be leveraged. 'How would you use that strength to stand out?'",
    Weaknesses:
      "Your nudge should push for MORE HONEST ASSESSMENT of limitations. 'What would be the hardest part to improve or work around?'",
    Opportunities:
      "Your nudge should push for MORE SPECIFIC external opportunities — timing, context, who. 'What conditions would need to be true for that opportunity to happen?'",
    Threats:
      "Your nudge should push for MORE REALISTIC threats assessment. 'How likely is that, and what could you do to prevent or mitigate it?'",
  };

  return `You are an encouraging design thinking mentor. A student just added a point to the ${quad.name} quadrant of their SWOT Analysis.

${effortStrategy[effortLevel]}

${quadTone[quad.name]}

THIS IS AN ANALYSIS TOOL — analytical depth is valued here. Push for specificity and real-world thinking.

YOUR ROLE: Return a JSON object with your feedback. Keep the energy positive but analytical.

RULES:
- "acknowledgment": 3-8 word note referencing their specific point (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words, staying within the ${quad.name} quadrant
- Reference their specific point — don't be generic
- Never suggest the answer in your question

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Good thinking about resources!", "nudge": "What other resources would be hard to access or develop?"}

For low effort:
{"acknowledgment": "", "nudge": "Can you give a specific example of what you mean?"}`;
}

// ─── Cross-Quadrant Insights ───

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor reviewing a student's complete SWOT Analysis. They have evaluated a design idea from four angles: Strengths, Weaknesses, Opportunities, and Threats.

YOUR ROLE: Help the student see how their analysis CONNECTS across all four quadrants. This is about synthesis, strategy, and decision-making.

RULES:
- Identify 1-2 key tensions between quadrants (e.g., "Your strength in X directly counters the threat of Y", "Your weakness in X is an opportunity for partnership")
- Highlight the most insightful point from each quadrant
- Point out patterns: are most threats related, are most opportunities dependent on each other, etc.
- Ask 1 provocative question about what they should do NEXT with this analysis: focus on strengths? Shore up weaknesses? Pursue opportunities? Mitigate threats?
- Be encouraging but honest — if analysis is surface-level, gently push for depth
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC points from their SWOT analysis

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

    const { allowed, retryAfterMs } = rateLimit(`swot:${sessionId}`, TOOLKIT_LIMITS);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Take a moment to think, then try again." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)) },
        }
      );
    }

    // ─── PROMPTS ───
    if (action === "prompts") {
      const quadrantIndex = body.quadrantIndex ?? 0;
      const existingIdeas = body.existingIdeas || [];
      const quad = QUADRANTS[quadrantIndex];

      if (!quad) {
        return NextResponse.json({ error: "Invalid quadrant index" }, { status: 400 });
      }

      const systemPrompt = buildPromptsSystemPrompt(quadrantIndex, existingIdeas.length);
      const userPrompt = `Design challenge or idea being analyzed: "${challenge}"
Current quadrant: ${quad.name} (${quad.focus})
${
  existingIdeas.length > 0
    ? `Student's existing points for this quadrant:\n${existingIdeas
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n")}`
    : "No points yet for this quadrant."
}

Generate 4 questions for the ${quad.name} quadrant.`;

      const result = await callHaiku(systemPrompt, userPrompt, 300);

      logUsage({
        endpoint: "tools/swot/prompts",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, quadrantIndex, action: "prompts" },
      });

      // Parse JSON array
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
          } catch {
            /* fall through */
          }
        }
      }
      return NextResponse.json({ prompts: null });
    }

    // ─── NUDGE ───
    if (action === "nudge") {
      const { idea, quadrantIndex = 0, existingIdeas = [], effortLevel = "medium" } = body;
      if (!idea?.trim()) {
        return NextResponse.json({ error: "Missing idea" }, { status: 400 });
      }
      const quad = QUADRANTS[quadrantIndex];
      if (!quad) {
        return NextResponse.json({ error: "Invalid quadrant index" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(quadrantIndex, effortLevel);
      const userPrompt = `Design challenge: "${challenge}"
Current quadrant: ${quad.name} (${quad.focus})
Student's new point: "${idea}"
${
  existingIdeas.length > 0
    ? `Their other points for this quadrant:\n${existingIdeas
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n")}`
    : "This is their first point for this quadrant."
}

Respond with your JSON feedback for the ${quad.name} quadrant.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);

      logUsage({
        endpoint: "tools/swot/nudge",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, quadrantIndex, effortLevel, action: "nudge" },
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
      const userPrompt = `Design challenge: "${challenge}"

The student's SWOT Analysis:
${QUADRANTS.map((quad, i) => {
  const points = allIdeas[i] || [];
  return `${quad.name} (${quad.focus}):\n${
    points.length > 0 ? points.map((t, j) => `  ${j + 1}. ${t}`).join("\n") : "  (no points recorded)"
  }`;
}).join("\n\n")}

Synthesize their analysis across all four quadrants.`;

      const result = await callHaiku(systemPrompt, userPrompt, 300);

      logUsage({
        endpoint: "tools/swot/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, action: "insights" },
      });

      return NextResponse.json({ insights: result.text });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[swot] API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
