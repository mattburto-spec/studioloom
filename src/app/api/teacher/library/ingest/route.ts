/**
 * POST /api/teacher/library/ingest
 *
 * Runs the Dimensions3 ingestion pipeline on uploaded text.
 * Accepts raw text (from client-side PDF/DOCX extraction) + copyright flag.
 * Returns full pipeline result including extracted blocks for review.
 *
 * Relocated from /api/teacher/knowledge/ingest in Phase 1.6 (11 Apr 2026)
 * as part of the old knowledge namespace teardown.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { extractDocument, sectionsToMarkdown } from "@/lib/ingestion/document-extract";
import type { PassConfig, CopyrightFlag } from "@/lib/ingestion/types";
import { persistModeratedBlocks } from "@/lib/ingestion/persist-blocks";

// Vercel serverless function timeout — full ingestion runs Pass A + Pass B + Extract + Moderate
export const maxDuration = 300;

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

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: "Could not extract any text from the uploaded file" }, { status: 400 });
    }
  } else {
    // ── JSON: existing path (unchanged) ──
    let body: { rawText?: string; copyrightFlag?: CopyrightFlag; sandboxMode?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    rawText = body.rawText || "";
    copyrightFlag = body.copyrightFlag;
    sandboxMode = body.sandboxMode === true;

    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "rawText is required and must be non-empty" },
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

  const adminClient = createAdminClient();
  const config: PassConfig = {
    supabaseClient: adminClient,
    teacherId,
    apiKey: process.env.ANTHROPIC_API_KEY,
    sandboxMode,
  };

  try {
    const result = await runIngestionPipeline(
      { rawText, copyrightFlag },
      config
    );

    // If not a duplicate, store as content_item for future reference
    if (!result.dedup.isDuplicate) {
      try {
        const { data: contentItem } = await adminClient
          .from("content_items")
          .insert({
            teacher_id: teacherId,
            title: result.parse.title || "Untitled",
            content_type: result.classification.documentType,
            subject: result.classification.detectedSubject,
            file_hash: result.dedup.fileHash,
            processing_status: result.moderationHold ? "moderation_hold" : "completed",
            raw_extracted_text: rawText,
            parsed_sections: result.parse.sections,
            classification: result.classification,
            enrichment: result.analysis,
            blocks_extracted: result.extraction.blocks.length,
            copyright_flag: copyrightFlag || "unknown",
          })
          .select("id")
          .single();

        if (contentItem) {
          result.contentItemId = contentItem.id;
        }
      } catch (e) {
        // content_items table may not exist yet — continue without storage
        console.error("[ingest] Failed to store content_item:", e);
      }
    }

    // Persist extracted blocks to activity_blocks for teacher review queue
    if (result.contentItemId && !result.dedup.isDuplicate && !result.moderationHold && result.moderation.blocks.length > 0) {
      try {
        const persist = await persistModeratedBlocks(adminClient, teacherId, result.contentItemId, result.moderation.blocks);
        console.log("[ingest] Persisted", persist.insertedCount, "blocks to review queue");
      } catch (e) {
        console.error("[ingest] Failed to persist moderated blocks:", e);
      }
    }

    // Pass 0 intent-guard: suggest redirect to import when document is a scheme of work
    const response: Record<string, unknown> = { ...result };
    if (result.classification.documentType === "scheme_of_work") {
      response.suggestedRedirect = "import";
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (e) {
    console.error("[ingest] Pipeline error:", e);
    return NextResponse.json(
      {
        error: "Ingestion pipeline failed",
        message: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
