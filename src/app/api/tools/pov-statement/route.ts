/**
 * Point of View Statement Toolkit AI API
 *
 * 3-step flow: User + Need + Insight → formatted POV statement
 *
 * Actions:
 *   1. "evaluate" — AI evaluates quality of the POV statement and suggests refinements
 *
 * Uses Haiku 4.5 for speed. Focuses on clarity and insight quality.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

type ActionType = "evaluate";

interface RequestBody {
  action: ActionType;
  sessionId: string;
  userDescription: string;
  needDescription: string;
  insightDescription: string;
}

// ─── Evaluation System Prompt ───

function buildEvaluationSystemPrompt(): string {
  return `You are a design thinking mentor evaluating a student's Point of View (POV) statement.

A well-formed POV statement has three parts:
1. USER: Specific, named, with context (not "people" — a particular person)
2. NEED: A verb-based need (to DO, FEEL, LEARN — not a product/thing)
3. INSIGHT: A surprising, non-obvious reason that reframes the problem

YOUR ROLE: Read the student's three-part statement and provide constructive feedback.

EVALUATION CRITERIA:
- User: Is this a specific person with context? (Not "users" — a name, age, background detail.)
- Need: Is this a need (verb-based) or a want/product? Does it answer "what do they need to DO or FEEL?"
- Insight: Is the insight surprising? Does it reframe the problem in a non-obvious way? Or is it a cliché reason?

FEEDBACK STYLE:
- Celebrate what's strong first
- Identify one area for improvement
- Suggest ONE specific refinement

RESPONSE FORMAT: Return a JSON object:
{
  "evaluation": "Your feedback here (2-3 sentences max)"
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
    const { action, sessionId, userDescription, needDescription, insightDescription } = body;

    if (action !== "evaluate") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!userDescription || !needDescription || !insightDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build prompt
    const systemPrompt = buildEvaluationSystemPrompt();
    const userPrompt = `Here's the student's POV statement:

USER: ${userDescription}

NEED: ${needDescription}

INSIGHT: ${insightDescription}

Evaluate this statement. Is it specific? Is the need verb-based? Is the insight surprising?`;

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
        max_tokens: 200,
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
    let evaluation = content;
    try {
      const parsed = JSON.parse(content);
      evaluation = parsed.evaluation || content;
    } catch {
      // If not valid JSON, use raw text
    }

    // Log usage
    logUsage({
      endpoint: "tools/pov-statement/evaluate",
      model: "claude-haiku-4-5-20251001",
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      metadata: { sessionId, action: "evaluate" },
    });

    return NextResponse.json({
      evaluation,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    });
  } catch (error) {
    console.error("POV Statement API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
