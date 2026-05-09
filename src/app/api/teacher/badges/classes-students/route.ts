import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";

/**
 * GET /api/teacher/badges/classes-students
 *
 * Returns all classes with their students for the authenticated teacher.
 * Used by the badge assign modal to grant badges to individual students.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const { teacherId } = auth;

    const admin = createAdminClient();

    // Get teacher's classes
    const { data: classes, error: classError } = await admin
      .from("classes")
      .select("id, name, code")
      .eq("teacher_id", teacherId)
      .neq("is_archived", true)
      .order("name");

    if (classError) {
      console.error("[badges/classes-students] Classes error:", classError);
      return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
    }

    if (!classes || classes.length === 0) {
      return NextResponse.json({ classes: [] });
    }

    // Get students in those classes via class_students junction (migration 041)
    const classIds = classes.map((c: { id: string }) => c.id);
    const { data: enrollments, error: studentError } = await admin
      .from("class_students")
      .select("student_id, class_id, students(id, display_name)")
      .in("class_id", classIds)
      .eq("is_active", true);

    if (studentError) {
      console.error("[badges/classes-students] Students error:", studentError);
      return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
    }

    // Group students by class
    const studentsByClass = new Map<string, Array<{ id: string; display_name: string }>>();
    for (const row of (enrollments || []) as any[]) {
      if (!row.students) continue;
      const arr = studentsByClass.get(row.class_id) || [];
      arr.push({ id: row.students.id, display_name: row.students.display_name });
      studentsByClass.set(row.class_id, arr);
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
