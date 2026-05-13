// audit-skip: Unit Briefs Foundation Phase B.5. Teacher-author-only
// spec diagram upload — pedagogical content authoring, same audit-class
// as the parent /api/teacher/unit-brief route. Author gate via
// verifyTeacherHasUnit.isAuthor. Tracked under FU-BRIEFS-AUDIT-COVERAGE.
//
// Spec diagram upload + delete for unit briefs.
//
// Storage path: unit-images/<unitId>/brief-diagram-<timestamp>.jpg
//   - unit-images bucket is already private + auth-gated (security-plan.md P-3)
//   - Path[0] = unitId so the existing authorizeUnitImagesAccess function
//     already handles read auth (students enrolled / teachers with access /
//     platform admins). No new proxy rule needed.
//
// One diagram per brief. Re-upload writes a new timestamped file and
// best-effort deletes the old one. Storage churn is bounded by teacher
// edits.

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { verifyTeacherHasUnit } from "@/lib/auth/verify-teacher-unit";
import { buildStorageProxyUrl } from "@/lib/storage/proxy-url";
import type { UnitBrief, UnitBriefConstraints } from "@/types/unit-brief";

const BUCKET = "unit-images";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB raw
const COLUMNS_RETURNED =
  "unit_id, brief_text, constraints, diagram_url, created_at, updated_at, created_by";

const GENERIC_CONSTRAINTS: UnitBriefConstraints = {
  archetype: "generic",
  data: {},
};

function coerceConstraints(raw: unknown): UnitBriefConstraints {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return GENERIC_CONSTRAINTS;
  }
  const r = raw as Record<string, unknown>;
  if (r.archetype === "design" && r.data && typeof r.data === "object") {
    return { archetype: "design", data: r.data as UnitBriefConstraints["data"] };
  }
  return GENERIC_CONSTRAINTS;
}

function rowToBrief(row: Record<string, unknown>): UnitBrief {
  return {
    unit_id: row.unit_id as string,
    brief_text: (row.brief_text as string | null) ?? null,
    constraints: coerceConstraints(row.constraints),
    diagram_url: (row.diagram_url as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    created_by: (row.created_by as string | null) ?? null,
  };
}

/**
 * Resize + compress a diagram. Larger than thumbnails (1600x1200)
 * because students need detail to read annotations, but still capped
 * so a 4032×3024 phone photo doesn't blow out storage. JPEG quality 85
 * preserves text legibility better than 80 (acceptable tradeoff —
 * diagrams are infrequent, one per brief).
 */
async function compressDiagram(buffer: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(buffer))
    .resize(1600, 1200, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}

/**
 * Parse the storage path out of a proxy URL.
 *   "/api/storage/unit-images/abc/brief-diagram-12345.jpg"
 *     → "abc/brief-diagram-12345.jpg"
 * Returns null if the URL doesn't match this bucket's proxy shape — used
 * for best-effort delete of old diagrams; a parse miss just skips delete.
 */
function pathFromProxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `/api/storage/${BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return path.length > 0 ? path : null;
}

/**
 * POST /api/teacher/unit-brief/diagram
 *
 * FormData: file (image), unitId (string).
 *
 * Validates the file (image MIME type, ≤10MB raw), compresses to JPEG,
 * uploads to unit-images/<unitId>/brief-diagram-<ts>.jpg, then upserts
 * the unit_briefs row with the new diagram_url. Best-effort deletes
 * the previous diagram so we don't accumulate orphans.
 *
 * Author-only (verifyTeacherHasUnit.isAuthor).
 */
export const POST = withErrorHandler(
  "teacher/unit-brief-diagram:POST",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid multipart/form-data body" },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    const unitIdRaw = formData.get("unitId");

    if (typeof unitIdRaw !== "string" || unitIdRaw.length === 0) {
      return NextResponse.json(
        { error: "unitId required (string)" },
        { status: 400 },
      );
    }
    const unitId = unitIdRaw;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "file required (image)" },
        { status: 400 },
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 },
      );
    }

    const access = await verifyTeacherHasUnit(teacherId, unitId);
    if (!access.isAuthor) {
      return NextResponse.json(
        { error: "Only the unit author can upload a brief diagram" },
        { status: 403 },
      );
    }

    // Compress (best-effort — fall through to the raw bytes if sharp
    // chokes on an unusual format, matching the upload-unit-image route's
    // robustness). Sharp pulls EXIF + autorotates on JPEG output.
    const arrayBuffer = await file.arrayBuffer();
    let imageBuffer: Buffer;
    try {
      imageBuffer = await compressDiagram(arrayBuffer);
    } catch {
      imageBuffer = Buffer.from(arrayBuffer);
    }

    const admin = createAdminClient();

    // Read existing diagram_url so we can clean up after a successful
    // upload. Don't gate the upload on this — even if the read fails
    // we'll still proceed; worst case is an orphaned old file.
    const { data: existingRow } = await admin
      .from("unit_briefs")
      .select(COLUMNS_RETURNED)
      .eq("unit_id", unitId)
      .maybeSingle();

    const oldPath = pathFromProxyUrl(
      existingRow?.diagram_url as string | null | undefined,
    );

    const timestamp = Date.now();
    const storagePath = `${unitId}/brief-diagram-${timestamp}.jpg`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 },
      );
    }

    const diagramUrl = buildStorageProxyUrl(BUCKET, storagePath);

    const merged: Record<string, unknown> = existingRow
      ? { ...existingRow, diagram_url: diagramUrl }
      : {
          unit_id: unitId,
          brief_text: null,
          constraints: GENERIC_CONSTRAINTS,
          diagram_url: diagramUrl,
          created_by: teacherId,
        };

    const { data, error } = await admin
      .from("unit_briefs")
      .upsert(merged, { onConflict: "unit_id" })
      .select(COLUMNS_RETURNED)
      .single();

    if (error || !data) {
      // The storage object was created but the DB write failed — best-
      // effort cleanup so we don't strand an orphan file.
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return NextResponse.json(
        { error: error?.message ?? "Failed to save diagram URL" },
        { status: 500 },
      );
    }

    // Best-effort delete the previous file. Don't fail the request if
    // it errors — the new diagram_url is already pointing at the new file.
    if (oldPath && oldPath !== storagePath) {
      await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {});
    }

    return NextResponse.json({ brief: rowToBrief(data) });
  },
);

/**
 * DELETE /api/teacher/unit-brief/diagram?unitId=<uuid>
 *
 * Clears the diagram_url and best-effort deletes the file from storage.
 * Author-only. Idempotent — calling on a brief without a diagram just
 * sets the column to NULL and returns 200.
 */
export const DELETE = withErrorHandler(
  "teacher/unit-brief-diagram:DELETE",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId query parameter required" },
        { status: 400 },
      );
    }

    const access = await verifyTeacherHasUnit(teacherId, unitId);
    if (!access.isAuthor) {
      return NextResponse.json(
        { error: "Only the unit author can delete a brief diagram" },
        { status: 403 },
      );
    }

    const admin = createAdminClient();

    const { data: existingRow } = await admin
      .from("unit_briefs")
      .select(COLUMNS_RETURNED)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (!existingRow) {
      // No brief row exists → nothing to delete. Return null.
      return NextResponse.json({ brief: null });
    }

    const oldPath = pathFromProxyUrl(existingRow.diagram_url as string | null);

    const { data, error } = await admin
      .from("unit_briefs")
      .update({ diagram_url: null })
      .eq("unit_id", unitId)
      .select(COLUMNS_RETURNED)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to clear diagram URL" },
        { status: 500 },
      );
    }

    if (oldPath) {
      await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {});
    }

    return NextResponse.json({ brief: rowToBrief(data) });
  },
);
