// audit-skip: public anonymous free-tool, no actor identity
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  FREE_TOOL_LIMITS,
  freeToolRateLimitKey,
  isValidEmail,
} from "@/lib/tools/free-tool-limits";
import { buildMarkingCommentsPrompt } from "@/lib/tools/marking-comments-prompt";
import { getSupportedFrameworks } from "@/lib/ai/framework-vocabulary";
import { callAnthropicMessages } from "@/lib/ai/call";
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

    // --- Build prompt & call Haiku ---
    const systemPrompt = buildMarkingCommentsPrompt({
      framework: body.framework,
      criterion: body.criterion,
      studentWork: body.studentWork,
      focusLevel: body.focusLevel,
    });

    const callResult = await callAnthropicMessages({
      endpoint: "tools/marking-comments",
      model: MODELS.HAIKU,
      maxTokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Generate the marking comments as specified. Return only the JSON object.",
        },
      ],
      metadata: {
        email: body.email.toLowerCase(),
        framework: body.framework,
      },
    });

    if (!callResult.ok) {
      if (callResult.reason === "no_credentials") {
        return NextResponse.json({ error: "AI service is not configured." }, { status: 503 });
      }
      if (callResult.reason === "truncated") {
        throw new Error("AI response truncated (max_tokens hit)");
      }
      if (callResult.reason === "api_error") throw callResult.error;
      throw new Error(`AI call failed: ${callResult.reason}`);
    }

    const response = callResult.response;

    // Extract text
    let text = "";
    if (response.content && Array.isArray(response.content)) {
      const textBlock = response.content.find((block) => block.type === "text");
      text = textBlock?.type === "text" ? textBlock.text : "";
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

    // logUsage handled by callAnthropicMessages helper

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
