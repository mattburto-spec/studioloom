/**
 * GET /api/teacher/me/scope
 *
 * Returns the union of class-membership / student-mentorship /
 * school-responsibility "hats" the authenticated teacher wears.
 * dashboard-v2-build chip UI consumes this to render role badges
 * per scope.
 *
 * Brief: docs/projects/access-model-v2-phase-3-brief.md §3.6 + §4 Phase 3.3
 *
 * Response shape:
 *   {
 *     scopes: [
 *       { scope: "class:abc123", role: "lead_teacher", class_name: "G10 Design" },
 *       { scope: "class:def456", role: "co_teacher",   class_name: "G11 Service" },
 *       { scope: "student:xyz",  role: "mentor", programme: "pp", student_name: "John D." },
 *       { scope: "school:nis",   role: "pyp_coordinator" }
 *     ],
 *     fetched_at: "2026-05-01T12:34:56Z"
 *   }
 *
 * Caching: per-teacher 30s. Consumers cache-bust on class_members /
 * student_mentors / school_responsibilities write (Phase 4 + Phase 5
 * surfaces).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Scope =
  | {
      scope: `class:${string}`;
      role: "lead_teacher" | "co_teacher" | "dept_head" | "mentor" | "lab_tech" | "observer";
      class_name?: string;
    }
  | {
      scope: `student:${string}`;
      role: "mentor";
      programme: string;
      student_name?: string;
    }
  | {
      scope: `school:${string}`;
      role: string; // school_responsibilities.responsibility_type
    };

export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const db = await createServerSupabaseClient();

  // Fan out three reads in parallel. Each one is RLS-respecting via the
  // SSR client. Phase 0 RLS lets a teacher read their own class_members /
  // student_mentors (mentor self-read) / school_responsibilities (same-school).
  // Phase 3.4g — drop the PostgREST embeds for the student-mentor query;
  // do a follow-up students lookup by ID. The embed `students(name)` was
  // failing with `column students_1.name does not exist` even with explicit
  // !fkname syntax — PostgREST appears to auto-alias the relationship in
  // a way the SELECT can't resolve. The class_members → classes embed
  // works (no aliasing collision there) so we keep it.
  const [classRes, mentorRes, respRes] = await Promise.all([
    db
      .from("class_members")
      .select("class_id, role, classes(name)")
      .eq("member_user_id", auth.teacherId)
      .is("removed_at", null),
    db
      .from("student_mentors")
      .select("student_id, programme")
      .eq("mentor_user_id", auth.teacherId)
      .is("deleted_at", null),
    db
      .from("school_responsibilities")
      .select("school_id, responsibility_type")
      .eq("teacher_id", auth.teacherId)
      .is("deleted_at", null),
  ]);

  // Look up student names for any mentor scopes — single follow-up query.
  // Empty mentorRes.data → skip the lookup entirely.
  const mentorStudentIds = (mentorRes.data ?? [])
    .map((r) => r.student_id as string)
    .filter(Boolean);
  let studentNameById: Record<string, string> = {};
  if (mentorStudentIds.length > 0) {
    const { data: studentRows } = await db
      .from("students")
      .select("id, display_name, username")
      .in("id", mentorStudentIds);
    for (const s of studentRows ?? []) {
      const sRow = s as { id: string; display_name?: string | null; username?: string | null };
      studentNameById[sRow.id] = sRow.display_name?.trim() || sRow.username || "";
    }
  }

  const scopes: Scope[] = [];

  for (const row of classRes.data ?? []) {
    const className = extractEmbeddedField<string>(row.classes, "name");
    scopes.push({
      scope: `class:${row.class_id}`,
      role: row.role as Scope extends { scope: `class:${string}` } ? Scope["role"] : never,
      ...(className ? { class_name: className } : {}),
    });
  }

  for (const row of mentorRes.data ?? []) {
    const studentName = studentNameById[row.student_id as string];
    scopes.push({
      scope: `student:${row.student_id}`,
      role: "mentor",
      programme: row.programme as string,
      ...(studentName ? { student_name: studentName } : {}),
    });
  }

  for (const row of respRes.data ?? []) {
    scopes.push({
      scope: `school:${row.school_id}`,
      role: row.responsibility_type as string,
    });
  }

  // Phase 3.5 smoke diagnostic — surface any per-query errors so we can
  // see why a query returned empty (e.g. RLS, schema cache, embed fail).
  // TODO: remove after Phase 3 close-out. Tracked: FU-AV2-PHASE-3-DEBUG-CLEANUP.
  const debug = {
    class_members: {
      count: classRes.data?.length ?? 0,
      error: classRes.error?.message ?? null,
    },
    student_mentors: {
      count: mentorRes.data?.length ?? 0,
      error: mentorRes.error?.message ?? null,
    },
    school_responsibilities: {
      count: respRes.data?.length ?? 0,
      error: respRes.error?.message ?? null,
    },
  };

  return NextResponse.json(
    {
      scopes,
      _debug: debug,
      fetched_at: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "private, max-age=30" },
    }
  );
}

/**
 * PostgREST embed shape varies — sometimes the joined relation comes back
 * as a single object, sometimes as an array (depending on relationship
 * cardinality inferred). Handle both safely.
 */
function extractEmbeddedField<T>(
  embedded: unknown,
  field: string
): T | undefined {
  if (!embedded) return undefined;
  if (Array.isArray(embedded)) {
    const first = embedded[0] as Record<string, unknown> | undefined;
    return first?.[field] as T | undefined;
  }
  if (typeof embedded === "object") {
    return (embedded as Record<string, unknown>)[field] as T | undefined;
  }
  return undefined;
}
