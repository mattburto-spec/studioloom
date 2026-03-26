import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

// GET: Validate current student session and return student data
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const response = NextResponse.json({ error: "No session" }, { status: 401 });
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  }

  const supabase = createAdminClient();

  // Step 1: Find the session by token (no joins — isolate from FK issues)
  const { data: session, error: sessionError } = await supabase
    .from("student_sessions")
    .select("id, student_id, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError || !session) {
    const response = NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
    // Don't delete cookie here — it may just be a DB hiccup
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  }

  // Step 2: Get the student (try with new columns, fall back if migration 050 not applied)
  let student: Record<string, unknown> | null = null;
  let studentError: unknown = null;

  const { data: s1, error: e1 } = await supabase
    .from("students")
    .select("id, username, display_name, ell_level, class_id, learning_profile, mentor_id, theme_id")
    .eq("id", session.student_id)
    .single();

  if (!e1 && s1) {
    student = s1;
  } else {
    // Fallback: mentor_id/theme_id columns may not exist yet (pre-migration 050)
    const { data: s2, error: e2 } = await supabase
      .from("students")
      .select("id, username, display_name, ell_level, class_id, learning_profile")
      .eq("id", session.student_id)
      .single();
    student = s2;
    studentError = e2;
  }

  if (studentError || !student) {
    const response = NextResponse.json(
      { error: "Student not found" },
      { status: 401 }
    );
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  }

  // Step 3: Get class info — try junction table first, then legacy class_id
  let classInfo: { id: string; name: string; code: string } | null = null;

  // New path: class_students junction (migration 041)
  const { data: enrollment } = await supabase
    .from("class_students")
    .select("class_id, classes(id, name, code)")
    .eq("student_id", student.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (enrollment?.classes) {
    classInfo = enrollment.classes as unknown as { id: string; name: string; code: string };
  }

  // Legacy fallback: students.class_id
  if (!classInfo && student.class_id) {
    const { data: legacyClass } = await supabase
      .from("classes")
      .select("id, name, code")
      .eq("id", student.class_id)
      .maybeSingle();

    if (legacyClass) {
      classInfo = legacyClass;
    }
  }

  const response = NextResponse.json({
    student: {
      id: student.id,
      username: student.username,
      display_name: student.display_name,
      ell_level: student.ell_level,
      class_id: classInfo?.id || student.class_id,
      classes: classInfo,
      learning_profile: (student as any).learning_profile ?? null,
      mentor_id: (student as any).mentor_id ?? null,
      theme_id: (student as any).theme_id ?? null,
    },
  });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return response;
}

// DELETE: Logout — clear session
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const supabase = createAdminClient();
    await supabase.from("student_sessions").delete().eq("token", token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return response;
}
