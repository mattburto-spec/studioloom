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
import { runIngestionPipeline, runContinueStage } from "@/lib/ingestion/pipeline";
import { reconstructUnit, reconstructionToContentData } from "@/lib/ingestion/unit-import";
import { extractDocument, sectionsToMarkdown } from "@/lib/ingestion/document-extract";
import { persistModeratedBlocks } from "@/lib/ingestion/persist-blocks";
import { storeCorrection } from "@/lib/ingestion/corrections";
import { computeHash } from "@/lib/ingestion/dedup";
import { parseDocument } from "@/lib/ingestion/parse";
import type { PassConfig, CopyrightFlag, IngestionClassification, IngestionPipelineResult } from "@/lib/ingestion/types";

// Vercel serverless function timeout — import runs Pass B + Extract + Moderate + Persist
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let classification: any = undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let corrections: any = undefined;

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
    // ── JSON: either full pipeline or continue-from-checkpoint ──
    let body: {
      rawText?: string;
      copyrightFlag?: CopyrightFlag;
      sandboxMode?: boolean;
      // Continue-from-checkpoint fields:
      classification?: IngestionClassification;
      corrections?: {
        correctedDocumentType?: string;
        correctedSubject?: string;
        correctedGradeLevel?: string;
        correctedSectionCount?: number;
        correctionNote?: string;
      };
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    rawText = body.rawText || "";
    copyrightFlag = body.copyrightFlag;
    sandboxMode = body.sandboxMode === true;
    classification = body.classification;
    corrections = body.corrections;

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
    skipDedup: true, // Import always re-processes — dedup would return empty blocks
  };

  try {
    // ── Two paths: full pipeline OR continue from checkpoint ──
    let ingestion: IngestionPipelineResult;

    if (classification && typeof classification === "object") {
      // Continue path: checkpoint already ran classify, now run Pass B + Extract + Persist
      const parse = parseDocument(rawText);

      // Store correction if any fields were changed
      if (corrections && typeof corrections === "object") {
        const hasCorrections = corrections.correctedDocumentType ||
          corrections.correctedSubject || corrections.correctedGradeLevel ||
          corrections.correctedSectionCount || corrections.correctionNote;

        if (hasCorrections) {
          await storeCorrection(config, {
            aiDocumentType: classification.documentType,
            aiSubject: classification.detectedSubject,
            aiGradeLevel: classification.detectedLevel,
            aiSectionCount: classification.sections?.length,
            correctedDocumentType: corrections.correctedDocumentType,
            correctedSubject: corrections.correctedSubject,
            correctedGradeLevel: corrections.correctedGradeLevel,
            correctedSectionCount: corrections.correctedSectionCount,
            correctionNote: corrections.correctionNote,
            documentTitle: parse.title,
            fileHash: computeHash(rawText),
          });
        }
      }

      // Apply user corrections to classification before passing to Pass B
      const correctedClassification: IngestionClassification = {
        ...classification,
        documentType: (corrections?.correctedDocumentType || classification.documentType) as IngestionClassification["documentType"],
        detectedSubject: corrections?.correctedSubject || classification.detectedSubject,
        detectedLevel: corrections?.correctedGradeLevel || classification.detectedLevel,
      };

      ingestion = await runContinueStage(
        {
          rawText,
          classification: correctedClassification,
          parse,
          copyrightFlag,
          userCorrections: corrections ? {
            correctedSectionCount: corrections.correctedSectionCount,
            correctionNote: corrections.correctionNote,
          } : undefined,
        },
        config
      );
    } else {
      // Full pipeline path (backward compat — no checkpoint)
      ingestion = await runIngestionPipeline(
        { rawText, copyrightFlag },
        config
      );
    }

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

    // ── Persist to Dimensions3 knowledge system ──
    // Same as /library/ingest: save the document + blocks so the system
    // learns from every import, not just knowledge library uploads.
    let contentItemId: string | null = null;

    try {
      const fileHash = computeHash(rawText);
      const { data: contentItem } = await adminClient
        .from("content_items")
        .insert({
          teacher_id: teacherId,
          title: ingestion.parse.title || "Imported Unit",
          content_type: ingestion.classification.documentType,
          subject: ingestion.classification.detectedSubject,
          file_hash: fileHash,
          processing_status: "completed",
          raw_extracted_text: rawText.slice(0, 100_000), // cap storage
          parsed_sections: ingestion.parse.sections,
          classification: ingestion.classification,
          enrichment: ingestion.analysis,
          blocks_extracted: ingestion.extraction.blocks.length,
          copyright_flag: copyrightFlag || "unknown",
        })
        .select("id")
        .single();

      if (contentItem) {
        contentItemId = contentItem.id;
      }
    } catch (e) {
      // content_items table may not exist — continue without storage
      console.error("[library/import] Failed to store content_item:", e);
    }

    // Persist extracted blocks to activity_blocks for the block library
    if (contentItemId && ingestion.moderation.blocks.length > 0) {
      try {
        const persist = await persistModeratedBlocks(
          adminClient,
          teacherId,
          contentItemId,
          ingestion.moderation.blocks
        );
        console.log(
          "[library/import] Persisted",
          persist.insertedCount,
          "blocks to library"
        );
      } catch (e) {
        console.error("[library/import] Failed to persist blocks:", e);
      }
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
          documentTitle: ingestion.parse.title || ingestion.classification.topic || "Imported Unit",
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
