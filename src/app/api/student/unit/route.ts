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

  // Get student's class and name
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

  // Get class-unit settings — try with new columns, fall back if migrations not yet applied
  let classUnit: Record<string, unknown> | null = null;
  const { data: cuFull, error: cuError } = await supabase
    .from("class_units")
    .select("locked_page_ids, is_active, final_due_date, page_due_dates, page_settings, content_data")
    .eq("class_id", student.class_id)
    .eq("unit_id", unitId)
    .single();

  if (cuError && (cuError.message?.includes("does not exist") || cuError.message?.includes("Could not find"))) {
    // Columns from migration 011 not yet applied — fall back
    const { data: cuBasic } = await supabase
      .from("class_units")
      .select("locked_pages, is_active, final_due_date, page_due_dates, page_settings, content_data")
      .eq("class_id", student.class_id)
      .eq("unit_id", unitId)
      .single();

    if (!cuBasic) {
      // Try even more basic (page_due_dates/page_settings may also not exist)
      const { data: cuMinimal } = await supabase
        .from("class_units")
        .select("locked_pages, is_active, content_data")
        .eq("class_id", student.class_id)
        .eq("unit_id", unitId)
        .single();
      classUnit = cuMinimal as Record<string, unknown> | null;
    } else {
      classUnit = cuBasic as Record<string, unknown> | null;
    }
  } else {
    classUnit = cuFull as Record<string, unknown> | null;
  }

  if (!classUnit || !(classUnit as { is_active?: boolean }).is_active) {
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
  const contentDebug = {
    masterIsNull: unit.content_data == null,
    masterType: unit.content_data ? typeof unit.content_data : "null",
    masterVersion: unit.content_data && typeof unit.content_data === "object" ? (unit.content_data as Record<string, unknown>).version : undefined,
    masterHasPages: unit.content_data && typeof unit.content_data === "object" ? Array.isArray((unit.content_data as Record<string, unknown>).pages) : false,
    masterPageCount: unit.content_data && typeof unit.content_data === "object" && Array.isArray((unit.content_data as Record<string, unknown>).pages) ? ((unit.content_data as Record<string, unknown>).pages as unknown[]).length : 0,
    masterKeys: unit.content_data && typeof unit.content_data === "object" ? Object.keys(unit.content_data as Record<string, unknown>) : [],
    classUnitIsNull: cu.content_data == null,
    resolvedIsNull: resolvedContentData == null,
    resolvedVersion: resolvedContentData && typeof resolvedContentData === "object" ? (resolvedContentData as Record<string, unknown>).version : undefined,
  };
  console.log("[student/unit] content_data debug:", JSON.stringify(contentDebug));

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
