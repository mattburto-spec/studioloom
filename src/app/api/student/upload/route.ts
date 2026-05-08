// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";
import { buildStorageProxyUrl } from "@/lib/storage/proxy-url";

// POST: Upload a file to Supabase Storage
export async function POST(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const unitId = formData.get("unitId") as string | null;
  const pageId = formData.get("pageId") as string | null;

  if (!file || !unitId || !pageId) {
    return NextResponse.json(
      { error: "file, unitId, and pageId required" },
      { status: 400 }
    );
  }

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Generate unique filename
  const ext = file.name.split(".").pop() || "bin";
  const timestamp = Date.now();
  const filePath = `${studentId}/${unitId}/${pageId}/${timestamp}.${ext}`;

  // Read arrayBuffer once — reuse for moderation + upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Phase 5F: Synchronous image moderation gate (images only)
  const isImage = file.type.startsWith('image/');
  if (isImage) {
    try {
      const { allow } = await moderateAndLog(buffer, {
        classId: '',
        studentId,
        source: 'upload_image' as const,
      }, { gate: true, mimeType: file.type });
      if (!allow) {
        return NextResponse.json(
          { error: "This image can't be uploaded. Please choose a different image." },
          { status: 403 }
        );
      }
    } catch (modErr) {
      console.error('[upload] image moderation failed, allowing through:', modErr);
    }
  }

  // Upload to Supabase Storage (use buffer, not arrayBuffer)
  const { data, error } = await supabase.storage
    .from("responses")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build proxy URL — bucket is private (security-plan.md P-3); the
  // /api/storage/responses/* endpoint auth-gates + 302s to a fresh signed URL.
  const proxyUrl = buildStorageProxyUrl("responses", data.path);

  return NextResponse.json({
    url: proxyUrl,
    path: data.path,
    filename: file.name,
    size: file.size,
    type: file.type,
  });
}
