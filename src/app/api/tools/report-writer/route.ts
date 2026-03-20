import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  FREE_TOOL_LIMITS,
  freeToolRateLimitKey,
  isValidEmail,
} from "@/lib/tools/free-tool-limits";
import { buildReportWriterPrompt } from "@/lib/tools/report-writer-prompt";
import { logUsage } from "@/lib/usage-tracking";
import * as Sentry from "@sentry/nextjs";

const VALID_TONES = ["formal", "friendly"] as const;
const VALID_WORD_COUNTS = [50, 100, 150] as const;
const VALID_PRONOUNS = ["he", "she", "they"] as const;

interface RequestBody {
  email: string;
  studentName: string;
  pronouns: (typeof VALID_PRONOUNS)[number];
  subject: string;
  gradeLevel: string;
  strengths: string;
  areasForGrowth: string;
  additionalNotes?: string;
  tone: (typeof VALID_TONES)[number];
  wordCount: (typeof VALID_WORD_COUNTS)[number];
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

    if (!body.studentName?.trim()) {
      return NextResponse.json(
        { error: "Student name is required." },
        { status: 400 }
      );
    }

    if (!VALID_PRONOUNS.includes(body.pronouns)) {
      return NextResponse.json(
        { error: `Invalid pronouns. Must be one of: ${VALID_PRONOUNS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!body.subject?.trim()) {
      return NextResponse.json(
        { error: "Subject is required." },
        { status: 400 }
      );
    }

    if (!body.gradeLevel?.trim()) {
      return NextResponse.json(
        { error: "Grade/year level is required." },
        { status: 400 }
      );
    }

    if (!body.strengths?.trim() || body.strengths.length > 500) {
      return NextResponse.json(
        { error: "Key strengths are required (max 500 characters)." },
        { status: 400 }
      );
    }

    if (!body.areasForGrowth?.trim() || body.areasForGrowth.length > 500) {
      return NextResponse.json(
        { error: "Areas for growth are required (max 500 characters)." },
        { status: 400 }
      );
    }

    if (body.additionalNotes && body.additionalNotes.length > 500) {
      return NextResponse.json(
        { error: "Additional notes must be under 500 characters." },
        { status: 400 }
      );
    }

    if (!VALID_TONES.includes(body.tone)) {
      return NextResponse.json(
        { error: `Invalid tone. Must be one of: ${VALID_TONES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!VALID_WORD_COUNTS.includes(body.wordCount)) {
      return NextResponse.json(
        { error: `Invalid word count. Must be one of: ${VALID_WORD_COUNTS.join(", ")}` },
        { status: 400 }
      );
    }

    // --- Rate limit ---
    const rateLimitKey = freeToolRateLimitKey("report-writer", body.email);
    const limit = rateLimit(rateLimitKey, FREE_TOOL_LIMITS);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            "You've used all 20 free report generations this month. Create a free Questerra account for unlimited access.",
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
    const systemPrompt = buildReportWriterPrompt({
      studentName: body.studentName.trim(),
      pronouns: body.pronouns,
      subject: body.subject.trim(),
      gradeLevel: body.gradeLevel.trim(),
      strengths: body.strengths.trim(),
      areasForGrowth: body.areasForGrowth.trim(),
      additionalNotes: body.additionalNotes?.trim(),
      tone: body.tone,
      wordCount: body.wordCount,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content:
              "Write the report comment as specified. Return only the JSON object.",
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

    // Parse JSON
    let report: string;
    try {
      const parsed = JSON.parse(text);
      report = parsed.report;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("Failed to parse AI response as JSON");
      }
      const parsed = JSON.parse(match[0]);
      report = parsed.report;
    }

    if (!report) {
      throw new Error("AI response missing report text");
    }

    // --- Log usage (fire-and-forget) ---
    logUsage({
      endpoint: "tools/report-writer",
      model: "claude-haiku-4-5-20251001",
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      metadata: {
        email: body.email.toLowerCase(),
        tone: body.tone,
        wordCount: body.wordCount,
      },
    });

    return NextResponse.json({
      report,
      remaining: limit.remaining,
    });
  } catch (error) {
    console.error("[report-writer]", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Failed to generate report. Please try again." },
      { status: 500 }
    );
  }
}
