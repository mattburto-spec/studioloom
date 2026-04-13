/**
 * POST /api/teacher/library/import
 *
 * Runs the Dimensions3 ingestion pipeline on uploaded text and then chains
 * reconstructUnit() to assemble the extracted blocks into a StudioLoom unit
 * structure with a per-lesson match report. Returns the shape that
 * /teacher/library/import/page.tsx expects: { reconstruction, contentData, ingestion }.
 *
 * Phase 1.6 cleanup (11 Apr 2026): replaces the deleted 501 placeholder stub
 * that previously lived at /api/teacher/knowledge/import. Mirrors the
 * structure of /api/teacher/library/ingest plus the reconstruction chain
 * documented by api/admin/smoke-tests/route.ts test #2.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { reconstructUnit, reconstructionToContentData } from "@/lib/ingestion/unit-import";
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

  if (!rawText || typeof rawText !== "string" || rawText.trim().length < 50) {
    return NextResponse.json(
      { error: "rawText is required and must be at least 50 characters" },
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
    const ingestion = await runIngestionPipeline(
      { rawText, copyrightFlag },
      config
    );

    // Phase 6C: If content was held for safety review, return early
    if (ingestion.moderationHold) {
      return NextResponse.json(
        {
          moderationHold: true,
          moderationHoldReason: ingestion.moderationHoldReason || "Content flagged by safety system",
        },
        { status: 200, headers: { "Cache-Control": "private, no-cache" } }
      );
    }

    const reconstruction = reconstructUnit(ingestion);
    const contentData = reconstructionToContentData(reconstruction);

    return NextResponse.json(
      {
        reconstruction,
        contentData,
        ingestion: {
          documentType: ingestion.classification.documentType,
          subject: ingestion.classification.detectedSubject ?? "unknown",
          gradeLevel: ingestion.classification.detectedLevel ?? "unknown",
          totalBlocks: ingestion.extraction.blocks.length,
          piiDetected: ingestion.extraction.piiDetected,
        },
      },
      { headers: { "Cache-Control": "private, no-cache" } }
    );
  } catch (e) {
    console.error("[library/import] Pipeline error:", e);
    return NextResponse.json(
      {
        error: "Import failed",
        message: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
