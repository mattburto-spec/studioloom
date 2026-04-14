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
import { extractDocument } from "@/lib/knowledge/extract";
import type { PassConfig, CopyrightFlag } from "@/lib/ingestion/types";

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
        rawText = extracted.rawText;
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
