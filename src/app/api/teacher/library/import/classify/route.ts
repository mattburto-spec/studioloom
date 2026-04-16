/**
 * POST /api/teacher/library/import/classify
 *
 * Phase 1 of the split import pipeline — runs Parse + Safety + Pass A only.
 * Returns classification for user review at an interactive checkpoint.
 * The client displays the classification, lets the teacher confirm or correct,
 * then calls /api/teacher/library/import/continue with the full context.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { runClassifyStage } from "@/lib/ingestion/pipeline";
import { extractDocument, sectionsToMarkdown } from "@/lib/ingestion/document-extract";
import { computeHash } from "@/lib/ingestion/dedup";
import type { CopyrightFlag } from "@/lib/ingestion/types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_EXTENSIONS = ["pdf", "docx", "pptx", "txt", "md"];

async function getTeacherId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function POST(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");

  let rawText: string;
  let copyrightFlag: CopyrightFlag | undefined;
  let sandboxMode = false;

  if (isMultipart) {
    // ── Multipart: extract text from uploaded file ──
    const formData = await request.formData();
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

  try {
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
    console.error("[library/import/classify] Pipeline error:", e);
    return NextResponse.json(
      {
        error: "Classification failed",
        message: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
