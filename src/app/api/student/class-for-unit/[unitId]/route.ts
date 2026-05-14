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

  // Two-step resolution. class_students and class_units share class_id
  // as a column but DO NOT have a direct FK between each other (both FK
  // independently to classes.id), so a PostgREST `!inner` embed doesn't
  // work — it silently returns no rows. Doing it explicitly:
  //
  //   1. enrollments = classes this student is in
  //   2. active class_units matching (any-of enrollments, this unit, active)

  const { data: enrollments, error: enrollErr } = await db
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);

  if (enrollErr) {
    console.error("[class-for-unit] enrollments lookup failed", enrollErr);
    return NextResponse.json({ classId: null, reason: "lookup_error" }, { status: 500 });
  }

  const classIds = (enrollments ?? []).map((e) => e.class_id as string);
  if (classIds.length === 0) {
    return NextResponse.json(
      { classId: null, reason: "no_enrollment" },
      { status: 200 },
    );
  }

  const { data: matches, error: matchErr } = await db
    .from("class_units")
    .select("class_id")
    .eq("unit_id", unitId)
    .eq("is_active", true)
    .in("class_id", classIds)
    .limit(1);

  if (matchErr) {
    console.error("[class-for-unit] class_units lookup failed", matchErr);
    return NextResponse.json({ classId: null, reason: "lookup_error" }, { status: 500 });
  }

  const firstMatch = (matches ?? [])[0];
  if (!firstMatch) {
    return NextResponse.json(
      { classId: null, reason: "unit_not_in_any_class" },
      { status: 200 },
    );
  }

  return NextResponse.json({ classId: firstMatch.class_id as string });
}
