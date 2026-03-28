import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { UnitContentData } from "@/types";

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

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get student info
  const { data: student } = await supabase
    .from("students")
    .select("class_id, ell_level, display_name, username")
    .eq("id", studentId)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Get the unit
  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("id", unitId)
    .single();

  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  // Find student's active class for this unit via junction table + legacy fallback
  // Step 1: Get all active class enrollments
  const { data: enrollments } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true);

  const activeClassIds = new Set<string>();
  if (enrollments) {
    for (const e of enrollments) activeClassIds.add(e.class_id);
  }
  // Legacy fallback
  if (student.class_id) activeClassIds.add(student.class_id);

  if (activeClassIds.size === 0) {
    return NextResponse.json(
      { error: "You are not enrolled in any active classes." },
      { status: 403 }
    );
  }

  // Step 2: Find the class_units row for this unit among student's active classes
  let classUnit: Record<string, unknown> | null = null;
  const { data: cuRows } = await supabase
    .from("class_units")
    .select("class_id, locked_page_ids, is_active, final_due_date, page_due_dates, page_settings, content_data")
    .in("class_id", Array.from(activeClassIds))
    .eq("unit_id", unitId)
    .eq("is_active", true);

  if (cuRows && cuRows.length > 0) {
    classUnit = cuRows[0] as Record<string, unknown>;
  }

  if (!classUnit) {
    return NextResponse.json(
      { error: "Unit not assigned to your class" },
      { status: 403 }
    );
  }

  // Get progress
  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", studentId)
    .eq("unit_id", unitId);

  const cu = classUnit as Record<string, unknown>;

  // Normalize locked pages — support both locked_page_ids (TEXT[]) and locked_pages (INT[])
  const lockedPages = (cu.locked_page_ids as string[]) || (cu.locked_pages as string[]) || [];

  // Normalize progress — ensure page_id exists on every record
  const normalizedProgress = (progress || []).map((p: Record<string, unknown>) => {
    if (!p.page_id && p.page_number) {
      return { ...p, page_id: NUMBER_TO_PAGE_ID[p.page_number as number] || `page_${p.page_number}` };
    }
    return p;
  });

  // Resolve content: prefer class-unit fork if it exists, fall back to master
  const resolvedContentData = resolveClassUnitContent(
    unit.content_data as UnitContentData,
    cu.content_data as UnitContentData | null | undefined
  );

  // Diagnostic logging — helps debug empty content_data issues
  const resolvedUnit = {
    ...unit,
    content_data: resolvedContentData,
  };

  return NextResponse.json({
    unit: resolvedUnit,
    lockedPages,
    progress: normalizedProgress,
    ellLevel: student.ell_level,
    finalDueDate: (cu.final_due_date as string) || null,
    pageDueDates: (cu.page_due_dates as Record<string, string>) || {},
    pageSettings: (cu.page_settings as Record<string, unknown>) || {},
    studentName: student.display_name || student.username,
  });
}
