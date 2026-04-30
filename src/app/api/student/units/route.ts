import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";

// Forward mapping for pre-migration-011 fallback
const NUMBER_TO_PAGE_ID: Record<number, string> = {
  1: "A1", 2: "A2", 3: "A3", 4: "A4",
  5: "B1", 6: "B2", 7: "B3", 8: "B4",
  9: "C1", 10: "C2", 11: "C3", 12: "C4",
  13: "D1", 14: "D2", 15: "D3", 16: "D4",
};

export async function GET(request: NextRequest) {
  // Phase 1.4b — explicit Supabase Auth via requireStudentSession.
  // Phase 1.4 CS-3 (30 Apr 2026) — RLS-respecting SSR client. Reads
  // students/class_students/classes/class_units/units/student_progress
  // under their respective student-side policies. Recursion-safe per
  // FU-AV2-RLS-SECURITY-DEFINER-AUDIT findings.
  //
  // FU-AV2-UNITS-ROUTE-CLASS-DISPLAY (30 Apr 2026 PM):
  //   - Drop legacy `students.class_id` fallback. Phase 0's backfill
  //     populated `class_students` from `students.class_id`, so every
  //     active enrollment is in the junction. The legacy column is
  //     scheduled for Phase 6 cutover.
  //   - Filter classes to non-archived BEFORE the class_units lookup.
  //     Without this, a unit shared between an active class and an
  //     archived legacy class could be attributed to the archived one
  //     for display.
  //   - Order enrollments by `enrolled_at DESC` so the most recently-
  //     enrolled active class wins on ties (deterministic; matches the
  //     tie-break in `resolveStudentClassId` per Bug 2 28 Apr 2026).
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const supabase = await createServerSupabaseClient();

  // 1. Get active enrollments ordered by recency (newest first).
  //    Drops the legacy `students.class_id` fallback (FU-AV2-UNITS-ROUTE-
  //    CLASS-DISPLAY). Junction is canonical post-Phase-0 backfill.
  const { data: enrollments } = await supabase
    .from("class_students")
    .select("class_id, enrolled_at")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .order("enrolled_at", { ascending: false });

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ units: [] });
  }

  const candidateClassIds = enrollments.map((e) => e.class_id as string);

  // 2. Filter classes to non-archived. RLS-respecting under Phase 1.4
  //    CS-1's `Students read own enrolled classes` policy.
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, subject, grade_level")
    .in("id", candidateClassIds)
    .or("is_archived.is.null,is_archived.eq.false");

  const classMap = new Map<string, { name: string; subject: string | null; grade_level: string | null }>();
  for (const c of classRows || []) {
    classMap.set(c.id, { name: c.name, subject: c.subject, grade_level: c.grade_level });
  }

  // Re-order to enrollment-recency order, dropping any archived classes.
  const orderedClassIds = candidateClassIds.filter((id) => classMap.has(id));

  if (orderedClassIds.length === 0) {
    return NextResponse.json({ units: [] });
  }

  // 3. Get active class_units for the live (non-archived) enrollments.
  let classUnits: Record<string, unknown>[] | null = null;

  const { data: cuNew, error: cuError } = await supabase
    .from("class_units")
    .select("unit_id, class_id, locked_page_ids, page_due_dates, content_data")
    .in("class_id", orderedClassIds)
    .eq("is_active", true);

  if (cuError && (cuError.message?.includes("does not exist") || cuError.message?.includes("Could not find"))) {
    const { data: cuOld } = await supabase
      .from("class_units")
      .select("unit_id, class_id, locked_pages, page_due_dates, content_data")
      .in("class_id", orderedClassIds)
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

  // FU-AV2-UNITS-ROUTE-CLASS-DISPLAY: when a unit appears in multiple of
  // the student's enrollments (e.g. unit reused across two classes the
  // student is in), pick the class_units row from the most-recently-
  // enrolled class. orderedClassIds is sorted by enrolled_at DESC.
  const cuByUnitId = new Map<string, Record<string, unknown>>();
  for (const classId of orderedClassIds) {
    for (const cu of classUnits) {
      const unitId = cu.unit_id as string;
      if (!cuByUnitId.has(unitId) && cu.class_id === classId) {
        cuByUnitId.set(unitId, cu);
      }
    }
  }

  // Get units
  const { data: units } = await supabase
    .from("units")
    .select("id, title, description, thumbnail_url, content_data")
    .in("id", unitIds);

  // Get progress for this student.
  // NB: earlier select included page_number + completed — neither exists on
  // student_progress in current schema, which caused Supabase to return
  // null + a silent error. We didn't destructure error so every unit saw
  // an empty progress array → every card read "Start unit" even when the
  // student had real progress. Using "*" defensively; payload is small.
  const { data: progress, error: progressError } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", studentId)
    .in("unit_id", unitIds);

  if (progressError) {
    console.error("[student/units] progress query error:", progressError);
  }

  // Combine units with progress
  const unitsWithProgress = (units || []).map((unit) => {
    // FU-AV2-UNITS-ROUTE-CLASS-DISPLAY: use the recency-ordered map
    // instead of .find() (which previously returned an arbitrary class
    // when a unit was in multiple of the student's enrollments).
    const cu = cuByUnitId.get(unit.id);
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
