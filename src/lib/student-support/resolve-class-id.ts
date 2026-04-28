/**
 * Phase 2.5 / Bug 2 — server-side classId resolution for student requests.
 *
 * Problem: client routes (lesson page, tap-a-word popover) need to tell the
 * server which class context they're in so per-class overrides apply
 * correctly. Three sources, in priority order:
 *
 *   1. Caller-supplied classId (UUID): trusted only if the student is
 *      actually enrolled in that class. Verifies enrollment, returns the
 *      classId on hit, undefined on miss (caller decides fallback).
 *
 *   2. Caller-supplied unitId (UUID): looks up class_units × class_students
 *      to find a class that uses this unit AND that the student is enrolled
 *      in. If multiple match (e.g. unit reused across two of the student's
 *      classes), returns the most-recently-enrolled one (deterministic, same
 *      tie-break as student-session route).
 *
 *   3. Neither: returns undefined → resolveStudentSettings falls back to
 *      "no class context" (per-student + intake + default).
 *
 * Lives in `student-support/` because Phase 2.5's resolveStudentSettings is
 * the primary consumer, but it's a pure helper — fine to use anywhere a
 * server route needs to convert a "loose" student/unit context into a
 * verified classId.
 *
 * Forward note: Option B (URL-scoped classId everywhere) makes this helper
 * obsolete — every URL will carry classId explicitly and the unitId branch
 * goes away. Until then, this is the bridge.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResolveClassIdInput {
  studentId: string;
  /** Caller-supplied classId. Trusted only after enrollment check. */
  classId?: string;
  /** Caller-supplied unitId — server derives classId via class_units JOIN. */
  unitId?: string;
}

/**
 * Returns a verified classId the student is enrolled in, or undefined.
 *
 * Never throws — query failures return undefined. Routes that care about
 * the difference between "no input" and "input was bad" should validate
 * input themselves before calling.
 */
/**
 * Filter a list of class IDs down to those that are NOT archived.
 *
 * Why split this out: archived classes are still selectable via
 * `class_students.is_active = true` because archive status lives on the
 * `classes` table and student enrollments aren't auto-deactivated when a
 * teacher archives the class. Without this filter, the resolver can pick
 * an archived class as a student's "current" context — observed in prod
 * 28 Apr 2026 when student `test`'s most-recent enrollment was an
 * archived class that happened to share a unit with an active class.
 *
 * Returns [] when input is empty (no extra round-trip).
 */
async function filterOutArchivedClasses(
  supabase: ReturnType<typeof createAdminClient>,
  classIds: string[]
): Promise<string[]> {
  if (classIds.length === 0) return [];
  const { data } = await supabase
    .from("classes")
    .select("id")
    .in("id", classIds)
    .or("is_archived.is.null,is_archived.eq.false");
  return (data ?? []).map((r) => r.id as string).filter(Boolean);
}

export async function resolveStudentClassId(
  input: ResolveClassIdInput
): Promise<string | undefined> {
  const supabase = createAdminClient();

  // Path 1: caller-supplied classId — verify enrollment AND non-archived.
  if (input.classId && UUID_RE.test(input.classId)) {
    const { data } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("student_id", input.studentId)
      .eq("class_id", input.classId)
      .eq("is_active", true)
      .maybeSingle();
    if (!data?.class_id) return undefined;
    // Bonus archived check — same reason as Path 2's filter. A teacher who
    // archives a class shouldn't have students still operating "in" it.
    const live = await filterOutArchivedClasses(supabase, [data.class_id as string]);
    return live[0];
    // Don't fall through to unitId if classId was given but invalid —
    // the caller's intent was specific. Return undefined and let caller
    // decide (current callers fall through to "no class context" defaults).
  }

  // Path 2: derive from unitId via class_units × class_students.
  if (input.unitId && UUID_RE.test(input.unitId)) {
    // Three-step query (no inner-join because PostgREST can be finicky about
    // cross-table FK ambiguity — see Lesson #54). Step 1: classes that use
    // this unit. Step 2: drop archived classes (28 Apr 2026 fix — without
    // this, an archived class with the same unit could win the tie-break
    // over the active class the student is "really" working in). Step 3:
    // intersection with student's active enrollments, ordered by enrollment
    // recency for deterministic tie-break.
    const { data: classUnits } = await supabase
      .from("class_units")
      .select("class_id")
      .eq("unit_id", input.unitId)
      .eq("is_active", true);

    const allCandidates = (classUnits ?? [])
      .map((r) => r.class_id as string)
      .filter(Boolean);

    const candidateClassIds = await filterOutArchivedClasses(supabase, allCandidates);
    if (candidateClassIds.length === 0) return undefined;

    const { data: enrollments } = await supabase
      .from("class_students")
      .select("class_id, enrolled_at")
      .eq("student_id", input.studentId)
      .eq("is_active", true)
      .in("class_id", candidateClassIds)
      .order("enrolled_at", { ascending: false })
      .limit(1);

    const match = enrollments?.[0]?.class_id as string | undefined;
    return match ?? undefined;
  }

  return undefined;
}
