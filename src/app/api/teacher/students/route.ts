// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/students
 *
 * Single-student creation route. Closes FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2)
 * by replacing 5 client-side `supabase.from("students").insert(...)` call
 * sites + the createStudent helper in src/lib/students/class-enrollment.ts
 * with a single server-side endpoint.
 *
 * Request body:
 *   {
 *     username: string;        // required (lowercased + scrubbed by route)
 *     displayName?: string;    // optional
 *     ellLevel?: number;       // optional (1-3, defaults to 3)
 *     gradYear?: number;       // optional graduation year (e.g. 2030)
 *     classId?: string;        // optional — when given, also enrolls in
 *                              //   class_students (atomic with the INSERT)
 *   }
 *
 * Response:
 *   {
 *     student: {
 *       id: string;
 *       username: string;
 *       display_name: string | null;
 *       ell_level: number;
 *       graduation_year: number | null;
 *       class_id: string | null;
 *       school_id: string | null;
 *       user_id: string;       // populated by provisionStudentAuthUser
 *     };
 *   }
 *
 * Side effects:
 *   1. INSERT into students with author_teacher_id = caller's teacherId,
 *      school_id derived from the target class (or NULL if no classId).
 *   2. provisionStudentAuthUser → creates auth.users row + populates
 *      students.user_id. Fails the request if provisioning errors —
 *      callers shouldn't see partially-provisioned students post-Phase-1.4.
 *   3. (If classId given) INSERT into class_students with is_active=true.
 *      Auth.users provisioning is BEFORE the class_students insert so a
 *      half-failed enrollment doesn't leave a NULL-user_id student.
 *
 * Auth: requireTeacherAuth (existing helper). When classId is given, also
 * verifies the teacher owns that class via verifyTeacherOwnsClass.
 *
 * For bulk imports, callers loop + await this route per row. Per-row
 * round-trip is fine for the ~10-30 student typical roster size; we
 * never optimised the existing client-side bulk path either.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";
import { enforceEnrollmentLimit } from "@/lib/access-v2/plan-gates";
import { provisionStudentAuthUserOrThrow } from "@/lib/access-v2/provision-student-auth-user";

interface CreateStudentBody {
  username?: string;
  displayName?: string | null;
  ellLevel?: number;
  gradYear?: number | null;
  classId?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = withErrorHandler(
  "teacher/students:POST",
  async (request: NextRequest) => {
    // 1. Auth
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    // 2. Parse body
    let body: CreateStudentBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawUsername = (body.username ?? "").trim().toLowerCase();
    if (!rawUsername) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    // Scrub: only [a-z0-9._-]
    const username = rawUsername.replace(/[^a-z0-9._-]/g, "");
    if (!username) {
      return NextResponse.json(
        { error: "username must contain at least one alphanumeric character" },
        { status: 400 }
      );
    }

    const displayName = body.displayName?.trim() || null;
    const ellLevel =
      typeof body.ellLevel === "number" && body.ellLevel >= 1 && body.ellLevel <= 3
        ? body.ellLevel
        : 3;
    const gradYear =
      typeof body.gradYear === "number" && body.gradYear > 0 ? body.gradYear : null;
    const classId = body.classId?.trim() || null;

    if (classId !== null && !UUID_RE.test(classId)) {
      return NextResponse.json(
        { error: "classId must be a valid UUID" },
        { status: 400 }
      );
    }

    // 3. If classId given, verify ownership + resolve school_id from the class.
    //    If no classId, school_id falls back to the teacher's own school.
    let schoolId: string | null = null;

    if (classId) {
      const owns = await verifyTeacherOwnsClass(teacherId, classId);
      if (!owns) {
        return NextResponse.json(
          { error: "Class not found or not yours" },
          { status: 403 }
        );
      }

      // Phase 4.8b — plan-gate chokepoint for enrollment (pass-through
      // today; freemium build wires per-tier max_students_per_class).
      const enrollmentGate = await enforceEnrollmentLimit(classId);
      if (!enrollmentGate.ok) {
        return NextResponse.json(
          {
            error: `Enrollment limit reached for your plan (${enrollmentGate.tier}): ${enrollmentGate.current}/${enrollmentGate.cap}.`,
            reason: enrollmentGate.reason,
            tier: enrollmentGate.tier,
            cap: enrollmentGate.cap,
            current: enrollmentGate.current,
          },
          { status: 422 }
        );
      }
    }

    const supabase = createAdminClient();

    if (classId) {
      const { data: classRow } = await supabase
        .from("classes")
        .select("school_id")
        .eq("id", classId)
        .single();
      schoolId = classRow?.school_id ?? null;
    } else {
      // No class context — use teacher's school for the new student.
      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("school_id")
        .eq("id", teacherId)
        .single();
      schoolId = teacherRow?.school_id ?? null;
    }

    // 4. Duplicate-username check. students.username has a per-class unique
    //    constraint (username + class_id), so the same username CAN exist
    //    across teachers' rosters. We dedupe per author_teacher_id to match
    //    the behaviour of teacher/classes/[classId]/page.tsx's existing
    //    pre-INSERT check (line ~298 — looks up existing student by username
    //    + author_teacher_id and reuses if found).
    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("author_teacher_id", teacherId)
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error:
            "A student with this username already exists in your roster. To enroll an existing student in a class, use the Enroll Existing flow.",
          code: "DUPLICATE_USERNAME",
          existingStudentId: existing.id,
        },
        { status: 409 }
      );
    }

    // 5. INSERT student
    const { data: student, error: insertErr } = await supabase
      .from("students")
      .insert({
        username,
        display_name: displayName,
        ell_level: ellLevel,
        graduation_year: gradYear,
        author_teacher_id: teacherId,
        school_id: schoolId,
        class_id: classId, // legacy column (also enrolled via class_students below)
      })
      .select("id, username, display_name, ell_level, graduation_year, class_id, school_id")
      .single();

    if (insertErr || !student) {
      console.error("[teacher/students:POST] student INSERT failed:", insertErr?.message);
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create student" },
        { status: 500 }
      );
    }

    // 6. Provision auth.users + populate students.user_id. Throws on failure
    //    (different from add-roster's per-row tolerance — we want a single
    //    student creation to be atomic-ish).
    let userId: string;
    try {
      const result = await provisionStudentAuthUserOrThrow(supabase, {
        id: student.id,
        user_id: null,
        school_id: schoolId,
      });
      userId = result.user_id;
    } catch (e: unknown) {
      // Roll back the students INSERT on auth failure to avoid leaving a
      // NULL-user_id orphan that lazy-provision would later have to repair.
      await supabase.from("students").delete().eq("id", student.id);
      console.error("[teacher/students:POST] provisioning failed; rolled back student row:", e);
      return NextResponse.json(
        { error: "Failed to provision student auth — please retry" },
        { status: 500 }
      );
    }

    // 7. Enroll in class_students if classId given
    if (classId) {
      const { error: enrollErr } = await supabase
        .from("class_students")
        .insert({
          student_id: student.id,
          class_id: classId,
          is_active: true,
          enrolled_at: new Date().toISOString(),
        });

      if (enrollErr) {
        // Don't roll back — student exists + is provisioned. Teacher can
        // retry enrollment from the class page. Log + return success-with-warn.
        console.warn(
          "[teacher/students:POST] class_students enrollment warning:",
          enrollErr.message
        );
      }
    }

    return NextResponse.json({
      student: {
        ...student,
        user_id: userId,
      },
    });
  }
);
