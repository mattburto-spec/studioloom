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
import type { PassConfig, CopyrightFlag } from "@/lib/ingestion/types";

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

  let body: { rawText?: string; copyrightFlag?: CopyrightFlag; sandboxMode?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { rawText, copyrightFlag, sandboxMode } = body;

  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    return NextResponse.json(
      { error: "rawText is required and must be non-empty" },
      { status: 400 }
    );
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
    sandboxMode: sandboxMode === true,
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
            processing_status: "completed",
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

    return NextResponse.json(result, {
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
