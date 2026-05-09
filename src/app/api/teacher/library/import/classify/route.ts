// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/library/import/classify
 *
 * Phase 1 of the split import pipeline — runs Parse + Safety + Pass A only.
 * Returns classification for user review at an interactive checkpoint.
 * The client displays the classification, lets the teacher confirm or correct,
 * then calls /api/teacher/library/import with the full context.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runClassifyStage } from "@/lib/ingestion/pipeline";
import { extractDocument, sectionsToMarkdown } from "@/lib/ingestion/document-extract";
import { computeHash } from "@/lib/ingestion/dedup";
import type { CopyrightFlag } from "@/lib/ingestion/types";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Vercel serverless function timeout — classify runs extraction + safety + Pass A
export const maxDuration = 300;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_EXTENSIONS = ["pdf", "docx", "pptx", "txt", "md"];

export async function POST(request: NextRequest) {
  // Top-level try/catch — ensures we ALWAYS return JSON, never a bare 500
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const { teacherId } = auth;

    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let rawText: string;
    let copyrightFlag: CopyrightFlag | undefined;
    let sandboxMode = false;

    if (isMultipart) {
      // ── Multipart: extract text from uploaded file ──
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch (e) {
        return NextResponse.json(
          { error: "Failed to parse upload", message: e instanceof Error ? e.message : "Unknown error" },
          { status: 400 }
        );
      }

      const file = formData.get("file") as File | null;
      copyrightFlag = (formData.get("copyrightFlag") as CopyrightFlag) || undefined;
      sandboxMode = formData.get("sandboxMode") === "true";

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 });
      }
      const ext = file.name.toLowerCase().split(".").pop() || "";
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Unsupported file type: .${ext}. Accepted: ${ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(", ")}` },
          { status: 400 }
        );
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (ext === "txt" || ext === "md") {
          rawText = buffer.toString("utf-8");
        } else {
          const extracted = await extractDocument(buffer, file.name, file.type);
          rawText = sectionsToMarkdown(extracted.sections);
        }
      } catch (e) {
        return NextResponse.json(
          { error: "Failed to extract text from file", message: e instanceof Error ? e.message : "Unknown error" },
          { status: 422 }
        );
      }

      if (!rawText || rawText.trim().length < 50) {
        return NextResponse.json({ error: "Extracted text is too short (need at least 50 characters)" }, { status: 400 });
      }
    } else {
      // ── JSON: rawText path ──
      let body: { rawText?: string; copyrightFlag?: CopyrightFlag; sandboxMode?: boolean };
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      rawText = body.rawText || "";
      copyrightFlag = body.copyrightFlag;
      sandboxMode = body.sandboxMode === true;

      if (!rawText || typeof rawText !== "string" || rawText.trim().length < 50) {
        return NextResponse.json(
          { error: "rawText is required and must be at least 50 characters" },
          { status: 400 }
        );
      }
    }

    if (rawText.length > 500_000) {
      return NextResponse.json(
        { error: "Document too large (max 500KB text)" },
        { status: 413 }
      );
    }

    // Admin client needed for fetchTeacherCorrections (few-shot injection into Pass A)
    const adminClient = createAdminClient();
    const config = {
      supabaseClient: adminClient,
      teacherId,
      apiKey: process.env.ANTHROPIC_API_KEY,
      sandboxMode: sandboxMode === true,
      skipDedup: true,
    };

    const result = await runClassifyStage(
      { rawText, copyrightFlag },
      config
    );

    // Moderation hold — return early with flag
    if (result.moderationHold) {
      return NextResponse.json(
        {
          moderationHold: true,
          moderationHoldReason: result.moderationHoldReason || "Content flagged by safety system",
        },
        { status: 200, headers: { "Cache-Control": "private, no-cache" } }
      );
    }

    return NextResponse.json(
      {
        classification: result.classification,
        rawText,
        parseResult: {
          title: result.parse.title,
          sectionCount: result.parse.sections.length,
          sectionHeadings: result.parse.sections.map(s => s.heading),
        },
        cost: result.cost,
        correctionsUsed: result.correctionsUsed,
        fileHash: computeHash(rawText),
      },
      { headers: { "Cache-Control": "private, no-cache" } }
    );
  } catch (e) {
    // Outermost catch — guarantees JSON response for ANY error
    console.error("[library/import/classify] Unhandled error:", e);

    // Detect Anthropic API overload (529) and rate limit (429) for user-friendly messages
    const errMsg = e instanceof Error ? e.message : String(e);
    const isOverloaded = errMsg.includes("overloaded") || errMsg.includes("Overloaded") || errMsg.includes("529");
    const isRateLimit = errMsg.includes("rate_limit") || errMsg.includes("429");

    const userMessage = isOverloaded
      ? "The AI service is temporarily overloaded. Please wait a moment and try again."
      : isRateLimit
        ? "Rate limit reached. Please wait a minute and try again."
        : errMsg;

    return NextResponse.json(
      {
        error: "Classification failed",
        message: userMessage,
        retryable: isOverloaded || isRateLimit,
      },
      { status: isOverloaded ? 503 : isRateLimit ? 429 : 500 }
    );
  }
}
