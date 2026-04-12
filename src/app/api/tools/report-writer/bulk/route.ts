import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  FREE_TOOL_LIMITS,
  freeToolRateLimitKey,
  isValidEmail,
} from "@/lib/tools/free-tool-limits";
import {
  buildReportWriterPrompt,
  ratingsToStrengthsAndGrowth,
  projectRatingsToPerformance,
} from "@/lib/tools/report-writer-prompt";
import { logUsage } from "@/lib/usage-tracking";
import type { BulkRequestBody, BulkReportResult } from "@/lib/tools/report-writer-types";
import { REPORTING_PERIODS } from "@/lib/tools/report-writer-types";
import * as Sentry from "@sentry/nextjs";
import { MODELS } from "@/lib/ai/models";

const VALID_TONES = ["formal", "friendly"] as const;
const VALID_WORD_COUNTS = [50, 100, 150] as const;
const MAX_STUDENTS_PER_CALL = 10;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BulkRequestBody;

    // --- Validate ---
    if (!body.email || !isValidEmail(body.email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
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

    if (!VALID_TONES.includes(body.tone as (typeof VALID_TONES)[number])) {
      return NextResponse.json(
        { error: "Invalid tone." },
        { status: 400 }
      );
    }

    if (!VALID_WORD_COUNTS.includes(body.wordCount as (typeof VALID_WORD_COUNTS)[number])) {
      return NextResponse.json(
        { error: "Invalid word count." },
        { status: 400 }
      );
    }

    if (
      body.reportingPeriod &&
      !REPORTING_PERIODS.includes(body.reportingPeriod)
    ) {
      return NextResponse.json(
        { error: "Invalid reporting period." },
        { status: 400 }
      );
    }

    if (body.projects) {
      if (
        !Array.isArray(body.projects) ||
        body.projects.length > 4 ||
        body.projects.some((p: string) => typeof p !== "string" || p.length > 100)
      ) {
        return NextResponse.json(
          { error: "Projects must be an array of up to 4 names (max 100 chars each)." },
          { status: 400 }
        );
      }
    }

    if (
      (!Array.isArray(body.categories) || body.categories.length === 0) &&
      (!Array.isArray(body.projects) || body.projects.length === 0)
    ) {
      return NextResponse.json(
        { error: "At least one category or project is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.students) || body.students.length === 0) {
      return NextResponse.json(
        { error: "At least one student is required." },
        { status: 400 }
      );
    }

    if (body.students.length > MAX_STUDENTS_PER_CALL) {
      return NextResponse.json(
        { error: `Maximum ${MAX_STUDENTS_PER_CALL} students per request.` },
        { status: 400 }
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

    // --- Process each student ---
    const reports: BulkReportResult[] = [];
    let generated = 0;
    let failed = 0;
    let lastRemaining = 0;

    for (const student of body.students) {
      // Rate limit per student
      const rateLimitKey = freeToolRateLimitKey("report-writer", body.email);
      const limit = rateLimit(rateLimitKey, FREE_TOOL_LIMITS);

      if (!limit.allowed) {
        reports.push({
          firstName: student.firstName,
          error: "Rate limit reached",
        });
        failed++;
        lastRemaining = 0;
        continue;
      }

      lastRemaining = limit.remaining;

      try {
        const { strengths, areasForGrowth } = ratingsToStrengthsAndGrowth(
          student.ratings,
          body.categories ?? []
        );

        const projects = body.projects ?? [];
        const projectPerformance = projectRatingsToPerformance(
          student.ratings,
          projects
        );

        const systemPrompt = buildReportWriterPrompt({
          studentName: student.firstName.trim(),
          pronouns: student.pronouns,
          subject: body.subject.trim(),
          gradeLevel: body.gradeLevel.trim(),
          reportingPeriod: body.reportingPeriod,
          projects: projects.length > 0 ? projects : undefined,
          projectPerformance: projectPerformance || undefined,
          strengths,
          areasForGrowth,
          additionalNotes: student.notes?.trim() || undefined,
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
            model: MODELS.HAIKU,
            max_tokens: 768,
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

        reports.push({ firstName: student.firstName, report });
        generated++;

        // Log usage (fire-and-forget)
        logUsage({
          endpoint: "tools/report-writer/bulk",
          model: MODELS.HAIKU,
          inputTokens: data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens,
          metadata: {
            email: body.email.toLowerCase(),
            tone: body.tone,
            wordCount: body.wordCount,
            batchStudent: student.firstName,
          },
        });
      } catch (err) {
        console.error(`[report-writer/bulk] Error for ${student.firstName}:`, err);
        Sentry.captureException(err);
        reports.push({
          firstName: student.firstName,
          error: "Failed to generate report",
        });
        failed++;
      }
    }

    return NextResponse.json({
      reports,
      remaining: lastRemaining,
      generated,
      failed,
    });
  } catch (error) {
    console.error("[report-writer/bulk]", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Failed to process bulk request. Please try again." },
      { status: 500 }
    );
  }
}
