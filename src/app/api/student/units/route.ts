import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";

// Forward mapping for pre-migration-011 fallback
const NUMBER_TO_PAGE_ID: Record<number, string> = {
  1: "A1", 2: "A2", 3: "A3", 4: "A4",
  5: "B1", 6: "B2", 7: "B3", 8: "B4",
  9: "C1", 10: "C2", 11: "C3", 12: "C4",
  13: "D1", 14: "D2", 15: "D3", 16: "D4",
};

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const supabase = createAdminClient();

  // Get ALL classes this student is enrolled in (junction table + legacy fallback)
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Collect class IDs from junction table
  const { data: enrollments } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true);

  const classIds = new Set<string>();
  // Add junction table enrollments
  if (enrollments) {
    for (const e of enrollments) {
      classIds.add(e.class_id);
    }
  }
  // Add legacy class_id as fallback
  if (student.class_id) {
    classIds.add(student.class_id);
  }

  if (classIds.size === 0) {
    return NextResponse.json({ units: [] });
  }

  const classIdArray = Array.from(classIds);

  // Get class names + subjects for display
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, subject, grade_level")
    .in("id", classIdArray);
  const classMap = new Map<string, { name: string; subject: string | null; grade_level: string | null }>();
  for (const c of classRows || []) {
    classMap.set(c.id, { name: c.name, subject: c.subject, grade_level: c.grade_level });
  }

  // Get active units from ALL enrolled classes
  let classUnits: Record<string, unknown>[] | null = null;

  const { data: cuNew, error: cuError } = await supabase
    .from("class_units")
    .select("unit_id, class_id, locked_page_ids, page_due_dates, content_data")
    .in("class_id", classIdArray)
    .eq("is_active", true);

  if (cuError && (cuError.message?.includes("does not exist") || cuError.message?.includes("Could not find"))) {
    const { data: cuOld } = await supabase
      .from("class_units")
      .select("unit_id, class_id, locked_pages, page_due_dates, content_data")
      .in("class_id", classIdArray)
      .eq("is_active", true);
    classUnits = cuOld as Record<string, unknown>[] | null;
  } else {
    classUnits = cuNew as Record<string, unknown>[] | null;
  }

  if (!classUnits || classUnits.length === 0) {
    return NextResponse.json({ units: [] });
  }

  // Deduplicate unit IDs (same unit may appear in multiple classes)
  const unitIds = [...new Set(classUnits.map((cu) => cu.unit_id as string))];

  // Get units
  const { data: units } = await supabase
    .from("units")
    .select("id, title, description, thumbnail_url, content_data")
    .in("id", unitIds);

  // Get progress for this student
  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", studentId)
    .in("unit_id", unitIds);

  // Combine units with progress
  const unitsWithProgress = (units || []).map((unit) => {
    const cu = classUnits!.find((c) => c.unit_id === unit.id);
    const lockedPages =
      (cu?.locked_page_ids as string[]) ||
      (cu?.locked_pages as string[]) ||
      [];

    // Normalize progress — ensure page_id exists
    const unitProgress = (progress || [])
      .filter((p) => p.unit_id === unit.id)
      .map((p: Record<string, unknown>) => {
        if (!p.page_id && p.page_number) {
          return { ...p, page_id: NUMBER_TO_PAGE_ID[p.page_number as number] || `page_${p.page_number}` };
        }
        return p;
      });

    // Resolve content: prefer class-unit fork if it exists, fall back to master
    const resolvedContentData = resolveClassUnitContent(
      unit.content_data as import("@/types").UnitContentData,
      cu?.content_data as import("@/types").UnitContentData | null | undefined
    );

    const classId = cu?.class_id as string | undefined;
    const classData = classId ? classMap.get(classId) : undefined;

    return {
      ...unit,
      content_data: resolvedContentData,
      progress: unitProgress,
      locked_pages: lockedPages,
      page_due_dates: (cu?.page_due_dates as Record<string, string>) || {},
      class_id: classId || null,
      class_name: classData?.name || null,
      class_subject: classData?.subject || null,
      class_grade_level: classData?.grade_level || null,
    };
  });

  return NextResponse.json({ units: unitsWithProgress });
}
