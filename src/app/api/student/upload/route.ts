import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

// Helper: get student ID from session cookie
async function getStudentId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  return session?.student_id || null;
}

// POST: Upload a file to Supabase Storage
export async function POST(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const { data, error } = await supabase.storage
    .from("responses")
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("responses").getPublicUrl(data.path);

  return NextResponse.json({
    url: publicUrl,
    path: data.path,
    filename: file.name,
    size: file.size,
    type: file.type,
  });
}
