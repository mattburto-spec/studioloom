import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  FREE_TOOL_LIMITS,
  freeToolRateLimitKey,
  isValidEmail,
} from "@/lib/tools/free-tool-limits";
import { buildMarkingCommentsPrompt } from "@/lib/tools/marking-comments-prompt";
import { getSupportedFrameworks } from "@/lib/ai/framework-vocabulary";
import { logUsage } from "@/lib/usage-tracking";
import * as Sentry from "@sentry/nextjs";
import { MODELS } from "@/lib/ai/models";

const VALID_FOCUS_LEVELS = ["below", "approaching", "meeting", "exceeding"] as const;
type FocusLevel = (typeof VALID_FOCUS_LEVELS)[number];

interface RequestBody {
  email: string;
  framework: string;
  criterion: string;
  studentWork: string;
  focusLevel?: FocusLevel;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    // --- Validate ---
    if (!body.email || !isValidEmail(body.email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const frameworks = getSupportedFrameworks();
    if (!body.framework || !frameworks.includes(body.framework)) {
      return NextResponse.json(
        { error: `Invalid framework. Must be one of: ${frameworks.join(", ")}` },
        { status: 400 }
      );
    }

    if (!body.criterion || body.criterion.length > 2000) {
      return NextResponse.json(
        { error: "Criterion description is required (max 2000 characters)." },
        { status: 400 }
      );
    }

    if (!body.studentWork || body.studentWork.length > 2000) {
      return NextResponse.json(
        { error: "Student work description is required (max 2000 characters)." },
        { status: 400 }
      );
    }

    if (
      body.focusLevel &&
      !VALID_FOCUS_LEVELS.includes(body.focusLevel)
    ) {
      return NextResponse.json(
        { error: `Invalid focus level. Must be one of: ${VALID_FOCUS_LEVELS.join(", ")}` },
        { status: 400 }
      );
    }

    // --- Rate limit ---
    const rateLimitKey = freeToolRateLimitKey("marking-comments", body.email);
    const limit = rateLimit(rateLimitKey, FREE_TOOL_LIMITS);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            "You've used all 20 free generations this month. Create a free Questerra account for unlimited access.",
          remaining: 0,
        },
        { status: 429 }
      );
    }

    // --- API key ---
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 503 }
      );
    }

    // --- Build prompt & call Haiku ---
    const systemPrompt = buildMarkingCommentsPrompt({
      framework: body.framework,
      criterion: body.criterion,
      studentWork: body.studentWork,
      focusLevel: body.focusLevel,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELS.HAIKU,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content:
              "Generate the marking comments as specified. Return only the JSON object.",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI call failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Extract text
    let text = "";
    if (data.content && Array.isArray(data.content)) {
      const textBlock = data.content.find(
        (block: { type: string; text?: string }) => block.type === "text"
      );
      text = textBlock?.text || "";
    }

    // Parse JSON — try direct parse, then regex fallback
    let comments: Record<string, string>;
    try {
      const parsed = JSON.parse(text);
      comments = parsed.comments;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("Failed to parse AI response as JSON");
      }
      const parsed = JSON.parse(match[0]);
      comments = parsed.comments;
    }

    if (
      !comments ||
      !comments.below ||
      !comments.approaching ||
      !comments.meeting ||
      !comments.exceeding
    ) {
      throw new Error("AI response missing required comment levels");
    }

    // --- Log usage (fire-and-forget) ---
    logUsage({
      endpoint: "tools/marking-comments",
      model: MODELS.HAIKU,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      metadata: {
        email: body.email.toLowerCase(),
        framework: body.framework,
      },
    });

    return NextResponse.json({
      comments,
      remaining: limit.remaining,
    });
  } catch (error) {
    console.error("[marking-comments]", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Failed to generate comments. Please try again." },
      { status: 500 }
    );
  }
}
