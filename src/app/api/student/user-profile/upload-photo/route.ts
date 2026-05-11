// audit-skip: Project Spec v2 — User Profile slot 7 image upload.
// Mirrors /api/student/upload but writes to the dedicated
// user-profile-photos bucket (per brief §12.4, Option B). One photo
// per (student, unit) — Replace UX upserts the same path.
//
// Service-role admin client bypasses storage RLS by design (the
// service_role_all policy on storage.objects is what permits this).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";
import { buildStorageProxyUrl } from "@/lib/storage/proxy-url";

const BUCKET = "user-profile-photos";
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/student/user-profile/upload-photo
 *
 * FormData fields:
 *   - file: File (image/*, ≤10MB)
 *   - unitId: string (uuid)
 *
 * Returns: { url: string } — proxy URL (e.g. /api/storage/user-profile-photos/<student>/<unit>.jpg).
 * The URL is what the client stores in slot_7.value.url.
 */
export async function POST(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const unitId = formData.get("unitId") as string | null;

  if (!file || !unitId) {
    return NextResponse.json(
      { error: "file and unitId required" },
      { status: 400 },
    );
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Must be an image (image/*)" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image too large (max 10MB)" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Synchronous image moderation gate — same pattern as /api/student/upload.
  try {
    const { allow } = await moderateAndLog(
      buffer,
      { classId: "", studentId, source: "upload_image" as const },
      { gate: true, mimeType: file.type },
    );
    if (!allow) {
      return NextResponse.json(
        { error: "This image can't be uploaded. Please choose a different image." },
        { status: 403 },
      );
    }
  } catch (modErr) {
    // Moderation failure must not block uploads — log and proceed (same
    // policy as /api/student/upload). Future hardening tracked as the
    // generic image moderation FU.
    console.error("[user-profile/upload-photo] moderation failed, allowing:", modErr);
  }

  // One photo per (student, unit). Path doesn't carry a timestamp —
  // Replace UX overwrites the same path. ext kept so the Content-Type
  // round-trips correctly through the storage proxy.
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const filePath = `${studentId}/${unitId}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true, // Replace UX
    });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to upload" },
      { status: 500 },
    );
  }

  const url = buildStorageProxyUrl(BUCKET, data.path);
  return NextResponse.json({ url });
}
