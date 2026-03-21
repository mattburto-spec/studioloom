import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
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
}

/**
 * GET /api/teacher/badges/classes-students
 *
 * Returns all classes with their students for the authenticated teacher.
 * Used by the badge assign modal to grant badges to individual students.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServer(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get teacher's classes
    const { data: classes, error: classError } = await admin
      .from("classes")
      .select("id, name, code")
      .eq("teacher_id", user.id)
      .neq("is_archived", true)
      .order("name");

    if (classError) {
      console.error("[badges/classes-students] Classes error:", classError);
      return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
    }

    if (!classes || classes.length === 0) {
      return NextResponse.json({ classes: [] });
    }

    // Get students in those classes
    const classIds = classes.map((c: { id: string }) => c.id);
    const { data: students, error: studentError } = await admin
      .from("students")
      .select("id, display_name, class_id")
      .in("class_id", classIds)
      .order("display_name");

    if (studentError) {
      console.error("[badges/classes-students] Students error:", studentError);
      return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
    }

    // Group students by class
    const studentsByClass = new Map<string, Array<{ id: string; display_name: string }>>();
    for (const s of students || []) {
      const arr = studentsByClass.get(s.class_id) || [];
      arr.push({ id: s.id, display_name: s.display_name });
      studentsByClass.set(s.class_id, arr);
    }

    const result = classes.map((c: { id: string; name: string; code: string }) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      students: studentsByClass.get(c.id) || [],
    }));

    return NextResponse.json({ classes: result });
  } catch (error) {
    console.error("[badges/classes-students] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
