/**
 * Feedback Capture Grid Toolkit AI API
 *
 * 4-quadrant form: Likes, Wishes, Questions, Ideas
 *
 * Actions:
 *   1. "synthesize" — AI synthesizes feedback into top 3 action items
 *
 * Uses Haiku 4.5 for speed.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

type ActionType = "synthesize";

interface RequestBody {
  action: ActionType;
  sessionId: string;
  prototypeDescription: string;
  feedback: {
    likes: string;
    wishes: string;
    questions: string;
    ideas: string;
  };
}

// ─── Synthesis System Prompt ───

function buildSynthesisSystemPrompt(): string {
  return `You are a design feedback facilitator. You've just collected feedback using the Feedback Capture Grid method.

The four quadrants are:
1. LIKES: What works well
2. WISHES: What could be better (constructive improvements)
3. QUESTIONS: What's unclear or missing information
4. IDEAS: New possibilities and suggestions

YOUR ROLE: Read the feedback across all quadrants and synthesize into TOP 3 ACTION ITEMS.

ACTION ITEMS should be:
- Specific (not vague)
- Achievable (not pie-in-the-sky)
- Prioritized by frequency and impact (if multiple people said the same thing, it's important)
- Balanced between quick wins and deeper improvements

RESPONSE FORMAT: Return a JSON object:
{
  "synthesis": "1. [First priority action with specific outcome]\n2. [Second priority action]\n3. [Third priority action]"
}`;
}

// ─── Handler ───

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = rateLimit(clientId, TOOLKIT_LIMITS);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body: RequestBody = await request.json();
    const { action, sessionId, prototypeDescription, feedback } = body;

    if (action !== "synthesize") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!prototypeDescription || !feedback.likes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build prompt
    const systemPrompt = buildSynthesisSystemPrompt();
    const userPrompt = `Prototype: ${prototypeDescription}

LIKES (What works well):
${feedback.likes || "(none provided)"}

WISHES (What could be better):
${feedback.wishes || "(none provided)"}

QUESTIONS (What's unclear):
${feedback.questions || "(none provided)"}

IDEAS (New possibilities):
${feedback.ideas || "(none provided)"}

Synthesize this feedback into top 3 action items. What should the designer focus on first?`;

    // Call Claude Haiku
    const response = await fetch("https://api.anthropic.com/v1/messages/create", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return NextResponse.json(
        { error: "Claude API error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    // Parse JSON response
    let synthesis = content;
    try {
      const parsed = JSON.parse(content);
      synthesis = parsed.synthesis || content;
    } catch {
      // If not valid JSON, use raw text
    }

    // Log usage
    logUsage({
      userId: sessionId,
      toolId: "feedback-capture-grid",
      model: "claude-haiku-4-5-20251001",
      action: "synthesize",
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    }).catch(console.error);

    return NextResponse.json({
      synthesis,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    });
  } catch (error) {
    console.error("Feedback Capture Grid API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
