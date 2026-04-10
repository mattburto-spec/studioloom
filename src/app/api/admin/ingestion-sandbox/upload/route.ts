/**
 * POST /api/admin/ingestion-sandbox/upload
 *
 * Phase 1.4 (Dimensions3 Completion Spec §3.4). Accepts a multipart file,
 * extracts text (PDF/DOCX/PPTX/plain), computes file hash, creates a
 * content_items row in `processing_status='pending'`, and returns the
 * rawText + title + contentItemId for the client-side pipeline runner.
 *
 * Auth: admin-only by convention (no explicit check — matches /admin/library).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { extractDocument } from "@/lib/knowledge/extract";
import { extractImages } from "@/lib/ingestion/image-extraction";

export const maxDuration = 300;

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const teacherId = (form.get("teacherId") as string | null) || process.env.SYSTEM_TEACHER_ID || null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (!teacherId) {
    return NextResponse.json(
      { error: "No teacherId provided and SYSTEM_TEACHER_ID env var unset" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const filename = file.name || "untitled";
  const ext = filename.toLowerCase().split(".").pop() || "";

  // Text extraction — routes through extractDocument which handles
  // PDF / DOCX / PPTX uniformly. Plain text/markdown handled here.
  let title = filename.replace(/\.[^.]+$/, "");
  let rawText = "";
  try {
    if (ext === "pdf" || ext === "docx" || ext === "pptx") {
      const doc = await extractDocument(buffer, filename, file.type || "");
      title = doc.title || title;
      rawText = doc.rawText;
    } else if (ext === "txt" || ext === "md") {
      rawText = buffer.toString("utf8");
    } else {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${ext}. Supported: pdf, docx, pptx, txt, md.`,
        },
        { status: 415 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "Text extraction failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }

  // Image extraction (stub — Seam 4 deferred). Always returns []. The call
  // is here so the wiring exists when content_assets lands; removing the
  // stub is then a one-line swap for the real implementation.
  const extractedImages = await extractImages(buffer, ext);

  if (!rawText || rawText.trim().length === 0) {
    return NextResponse.json({ error: "Extracted text is empty" }, { status: 422 });
  }
  if (rawText.length > 500_000) {
    return NextResponse.json(
      { error: "Document too large (max 500KB extracted text)" },
      { status: 413 }
    );
  }

  // Dedup check against prior content_items uploads (Lesson #24: narrow select)
  const sb = supabase();
  let isDuplicate = false;
  let existingContentItemId: string | null = null;
  try {
    const { data: existing } = await sb
      .from("content_items")
      .select("id")
      .eq("file_hash", fileHash)
      .eq("teacher_id", teacherId)
      .limit(1);
    if (existing && existing.length > 0) {
      isDuplicate = true;
      existingContentItemId = existing[0].id;
    }
  } catch (e) {
    console.warn("[sandbox/upload] dedup lookup failed:", e);
  }

  // Create a new content_items row (even for duplicates, so the sandbox
  // shows the path through the pipeline). The duplicate flag is surfaced.
  let contentItemId: string | null = null;
  try {
    const { data: row, error } = await sb
      .from("content_items")
      .insert({
        teacher_id: teacherId,
        title,
        file_hash: fileHash,
        processing_status: isDuplicate ? "completed" : "pending",
        raw_extracted_text: rawText,
        copyright_flag: (form.get("copyrightFlag") as string) || "unknown",
      })
      .select("id")
      .single();
    if (error) throw error;
    contentItemId = row.id;
  } catch (e) {
    // content_items may have a column drift — surface but don't fail the upload
    console.warn("[sandbox/upload] content_items insert failed:", e);
  }

  return NextResponse.json({
    contentItemId,
    existingContentItemId,
    isDuplicate,
    title,
    fileHash,
    sizeBytes: buffer.length,
    rawTextLength: rawText.length,
    rawText,
    extractedImageCount: extractedImages.length,
  });
}
