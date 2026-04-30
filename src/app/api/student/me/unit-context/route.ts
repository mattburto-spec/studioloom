import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveStudentClassId } from "@/lib/student-support/resolve-class-id";

/**
 * GET /api/student/me/unit-context?unitId=<uuid>
 *
 * Bug 1.5 — given a unitId from the URL, returns the (verified) class
 * the student is doing this unit IN, so the topnav can display the
 * correct class label even when the session-default class is for a
 * different enrollment.
 *
 * Response shape:
 *   { class: { id, name, code, framework? } | null }
 *
 * Returns class:null when no enrollment intersects this unit (e.g. the
 * unit was assigned to a class the student isn't in, or the unitId is
 * malformed). Caller should fall back to the session classInfo.
 *
 * Cheap by design — two indexed queries. Layout can call freely on every
 * unit-route navigation; the layout-side cache (per pathname) keeps this
 * to ~1 fetch per unit visit.
 */

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };

export async function GET(request: NextRequest) {
  // Phase 1.4b — explicit Supabase Auth via requireStudentSession.
  // Phase 1.4 CS-2 (30 Apr 2026) — RLS-respecting SSR client. CS-1
  // policies activate the canonical chain on classes + class_students.
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const unitId = request.nextUrl.searchParams.get("unitId") || undefined;
  if (!unitId) {
    return NextResponse.json(
      { error: "unitId is required" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const supabase = await createServerSupabaseClient();

  // TEMP DEBUG (Phase 1.4 CS-2 smoke) — reveal each resolver step. Remove after diagnosis.
  const debug: Record<string, unknown> = { studentId, unitId };

  // Direct probe: can the SSR client see class_units rows?
  const { data: classUnitsProbe, error: classUnitsErr } = await supabase
    .from("class_units")
    .select("class_id")
    .eq("unit_id", unitId)
    .eq("is_active", true);
  debug.classUnits = { rows: classUnitsProbe, error: classUnitsErr?.message };

  // Direct probe: can SSR client see classes for those candidates?
  const candidateIds = (classUnitsProbe ?? []).map((r) => r.class_id as string);
  const { data: classesProbe, error: classesErr } =
    candidateIds.length > 0
      ? await supabase
          .from("classes")
          .select("id, name, is_archived")
          .in("id", candidateIds)
      : { data: [], error: null };
  debug.classes = { rows: classesProbe, error: classesErr?.message };

  // Direct probe: can SSR client see test2's class_students rows?
  const { data: enrollmentsProbe, error: enrollmentsErr } = await supabase
    .from("class_students")
    .select("class_id, is_active")
    .eq("student_id", studentId);
  debug.classStudents = { rows: enrollmentsProbe, error: enrollmentsErr?.message };

  const classId = await resolveStudentClassId({
    studentId: studentId,
    unitId,
    supabase,
  });
  debug.resolverReturned = classId;

  if (!classId) {
    return NextResponse.json({ class: null, _debug: debug }, { headers: CACHE_HEADERS });
  }

  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id, name, code, framework")
    .eq("id", classId)
    .maybeSingle();
  debug.classQuery = { row: cls, error: clsErr?.message };

  return NextResponse.json({ class: cls ?? null, _debug: debug }, { headers: CACHE_HEADERS });
}
