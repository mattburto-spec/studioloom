import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentSession } from "@/lib/access-v2/actor-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET: Validate current student session and return student data
//
// Phase 6.1 (4 May 2026) — Supabase Auth only. The legacy
// questerra_student_session cookie + student_sessions table fallback
// (Path B) was removed when the table was dropped.
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();

  const studentSession = await getStudentSession(request);
  if (!studentSession) {
    const response = NextResponse.json({ error: "No session" }, { status: 401 });
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  }
  const studentId = studentSession.studentId;

  // Step 2: Get the student (try with new columns, fall back if migration 050 not applied)
  let student: Record<string, unknown> | null = null;
  let studentError: unknown = null;

  const { data: s1, error: e1 } = await supabase
    .from("students")
    .select("id, username, display_name, ell_level, class_id, learning_profile, mentor_id, theme_id")
    .eq("id", studentId)
    .single();

  if (!e1 && s1) {
    student = s1;
  } else {
    // Fallback: mentor_id/theme_id columns may not exist yet (pre-migration 050)
    const { data: s2, error: e2 } = await supabase
      .from("students")
      .select("id, username, display_name, ell_level, class_id, learning_profile")
      .eq("id", studentId)
      .single();
    student = s2;
    studentError = e2;
  }

  if (studentError || !student) {
    const response = NextResponse.json(
      { error: "Student not found" },
      { status: 401 }
    );
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  }

  // Step 3: Get class info — try junction table first, then legacy class_id
  let classInfo: { id: string; name: string; code: string; framework?: string | null } | null = null;

  // New path: class_students junction (migration 041).
  // ORDER BY enrolled_at DESC makes the "first" class deterministic when a
  // student is in multiple — we pick their most-recent enrollment as the
  // session-default class. Without this, .limit(1) returned a random row
  // each request and per-class teacher overrides (Phase 2.5 support-settings)
  // were applied to the wrong class.
  //
  // 28 Apr 2026: also filter archived classes. class_students.is_active
  // doesn't get flipped when a teacher archives the class, so without
  // this an archived class could win as the session-default. We pull the
  // top N enrollments and pick the most-recent non-archived one in JS
  // (cleaner than a nested PostgREST `.eq("classes.is_archived", ...)`
  // which silently returns rows where classes is null when the join is
  // optional — see Lesson #54-style FK ambiguity).
  //
  // Forward note: Option B (URL-scoped class context, ~10-day refactor) will
  // make this default irrelevant — every student URL will carry classId
  // explicitly. Until then, "most-recent non-archived enrollment" is the
  // sensible default for the dashboard + topnav display.
  const { data: enrollments } = await supabase
    .from("class_students")
    .select("class_id, classes(id, name, code, framework, is_archived)")
    .eq("student_id", student.id)
    .eq("is_active", true)
    .order("enrolled_at", { ascending: false })
    .limit(10);

  type EnrollmentClass = {
    id: string;
    name: string;
    code: string;
    framework?: string | null;
    is_archived?: boolean | null;
  };
  const liveEnrollment = (enrollments ?? []).find((e) => {
    const c = (Array.isArray(e.classes) ? e.classes[0] : e.classes) as
      | EnrollmentClass
      | null
      | undefined;
    return c && !c.is_archived;
  });

  if (liveEnrollment?.classes) {
    const c = (Array.isArray(liveEnrollment.classes)
      ? liveEnrollment.classes[0]
      : liveEnrollment.classes) as EnrollmentClass;
    classInfo = {
      id: c.id,
      name: c.name,
      code: c.code,
      framework: c.framework ?? null,
    };
  }

  // Legacy fallback: students.class_id
  if (!classInfo && student.class_id) {
    const { data: legacyClass } = await supabase
      .from("classes")
      .select("id, name, code, framework")
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

// DELETE: Logout — sign the student out of Supabase Auth.
//
// Phase 6.1 (4 May 2026) — replaces the legacy `student_sessions` row
// delete + cookie wipe with a Supabase Auth signOut. The SSR client
// clears the sb-* cookies on the response when signOut succeeds.
export async function DELETE(_request: NextRequest) {
  const ssrClient = await createServerSupabaseClient();
  await ssrClient.auth.signOut();

  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return response;
}
