import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";

/**
 * POST /api/student/avatar
 * Upload a new avatar image. Replaces any existing avatar.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Delete old avatar if it exists
  const { data: existing } = await supabase
    .from("students")
    .select("avatar_url")
    .eq("id", studentId)
    .single();

  if (existing?.avatar_url) {
    // Extract the storage path from the URL
    const oldPath = extractStoragePath(existing.avatar_url);
    if (oldPath) {
      await supabase.storage.from("responses").remove([oldPath]);
    }
  }

  // Upload new avatar
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${studentId}/avatar/avatar_${Date.now()}.${ext}`;

  // Read arrayBuffer once — reuse for moderation + upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Phase 5F: Fire-and-forget image moderation — private avatar
  moderateAndLog(buffer, {
    classId: '',
    studentId,
    source: 'upload_image' as const,
  }, { mimeType: file.type }).catch((err: unknown) => console.error('[avatar] moderation error:', err));

  const { data, error } = await supabase.storage
    .from("responses")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("responses").getPublicUrl(data.path);

  // Update student record
  const { error: updateError } = await supabase
    .from("students")
    .update({ avatar_url: publicUrl })
    .eq("id", studentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl });
}

/**
 * DELETE /api/student/avatar
 * Remove the avatar and revert to initials.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const supabase = createAdminClient();

  // Get current avatar URL
  const { data: student } = await supabase
    .from("students")
    .select("avatar_url")
    .eq("id", studentId)
    .single();

  if (student?.avatar_url) {
    const oldPath = extractStoragePath(student.avatar_url);
    if (oldPath) {
      await supabase.storage.from("responses").remove([oldPath]);
    }
  }

  // Clear avatar_url
  await supabase
    .from("students")
    .update({ avatar_url: null })
    .eq("id", studentId);

  return NextResponse.json({ success: true });
}

/**
 * Extract storage path from a Supabase public URL.
 * e.g. "https://xxx.supabase.co/storage/v1/object/public/responses/abc/avatar/img.jpg"
 * → "abc/avatar/img.jpg"
 */
function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/\/responses\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
