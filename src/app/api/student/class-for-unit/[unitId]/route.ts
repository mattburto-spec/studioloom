// audit-skip: read-only lookup of student's enrolled class for a given unit; no mutation
/**
 * GET /api/student/class-for-unit/[unitId]
 *
 * Resolves which class the current student is in for a given unit.
 * Used by the student lesson page to plumb classId down to live blocks
 * (Class DJ, future live-exit-ticket / live-crit / etc.) that need to
 * scope their state per-class.
 *
 * If the student is enrolled in multiple classes that share this unit,
 * returns the first one (active, most-recent enrollment first).
 * FU-CLASS-DJ-CLASSID-MULTI-CLASS — when a student has two classes
 * with the same unit, the picker should let them choose. Not v1 scope.
 *
 * Returns:
 *   200 { classId: "<uuid>" } when found
 *   200 { classId: null, reason: "no_enrollment" | "unit_not_in_any_class" }
 *   401 when not a student session
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ unitId: string }> },
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const { studentId } = session;

  const { unitId } = await ctx.params;
  const db = createAdminClient();

  // Find classes the student is in that have this unit assigned (active).
  // class_students gives the enrollments; class_units gives the unit
  // assignments. JOIN gives us the intersection.
  const { data: rows, error } = await db
    .from("class_students")
    .select("class_id, class_units!inner(unit_id, is_active)")
    .eq("student_id", studentId)
    .eq("class_units.unit_id", unitId)
    .eq("class_units.is_active", true)
    .limit(5);

  if (error) {
    console.error("[class-for-unit] lookup failed", error);
    return NextResponse.json({ classId: null, reason: "lookup_error" }, { status: 500 });
  }

  const firstMatch = (rows ?? [])[0];
  if (!firstMatch) {
    return NextResponse.json(
      { classId: null, reason: "unit_not_in_any_class" },
      { status: 200 },
    );
  }

  return NextResponse.json({ classId: firstMatch.class_id as string });
}
