/**
 * Teacher-ack path for skill.demonstrated events.
 *
 *   GET    /api/teacher/skills/cards/[id]/demonstrations   → list teacher's students grouped by class with demo state
 *   POST   /api/teacher/skills/cards/[id]/demonstrations   → body {student_id,note?} writes skill.demonstrated
 *   DELETE /api/teacher/skills/cards/[id]/demonstrations   → body {student_id} revokes the most recent ack
 *
 * Why this endpoint: Matt's Q2 on the world-class-skills-library review —
 * "teacher-ack button for demonstrated" as the v1 demo gate until the
 * studentwork pipeline ships. Digital Promise / Scouts both require an
 * external assessor moment; this is ours. A teacher taps a button; we
 * write a `skill.demonstrated` event; the student_skill_state view
 * promotes the student to rank 3.
 *
 * Auth: teacher session (requireTeacherAuth).
 * Scope: teacher must own a class the student is in (verified on POST/DELETE).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

interface StudentLite {
  id: string;
  display_name: string;
  username: string;
}

interface ClassLite {
  id: string;
  name: string;
  teacher_id: string | null;
  author_teacher_id: string | null;
}

/**
 * Collect every class owned by this teacher — matches the existing
 * "teacher_id OR author_teacher_id" dual-ownership pattern used throughout
 * the codebase.
 */
async function getTeacherClasses(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string
): Promise<ClassLite[]> {
  const { data } = await admin
    .from("classes")
    .select("id, name, teacher_id, author_teacher_id")
    .or(`teacher_id.eq.${teacherId},author_teacher_id.eq.${teacherId}`);
  return (data ?? []) as ClassLite[];
}

/**
 * Get students in a set of class IDs via the junction table. Falls back to
 * the legacy `students.class_id` column for rows that predate migration 041.
 */
async function getStudentsInClasses(
  admin: ReturnType<typeof createAdminClient>,
  classIds: string[]
): Promise<Array<{ classId: string; student: StudentLite }>> {
  if (classIds.length === 0) return [];
  const result: Array<{ classId: string; student: StudentLite }> = [];
  const seen = new Set<string>(); // dedupe (classId, studentId)

  // Junction table path (current)
  const { data: junctions } = await admin
    .from("class_students")
    .select("class_id, student_id, is_active")
    .in("class_id", classIds)
    .eq("is_active", true);

  const junctionStudentIds = (junctions ?? []).map(
    (r: { student_id: string }) => r.student_id
  );
  const studentsById = new Map<string, StudentLite>();
  if (junctionStudentIds.length > 0) {
    const { data: studentsJ } = await admin
      .from("students")
      .select("id, display_name, username")
      .in("id", junctionStudentIds);
    (studentsJ ?? []).forEach((s: StudentLite) =>
      studentsById.set(s.id, s)
    );
  }
  (junctions ?? []).forEach((j: { class_id: string; student_id: string }) => {
    const key = `${j.class_id}:${j.student_id}`;
    if (seen.has(key)) return;
    const stu = studentsById.get(j.student_id);
    if (!stu) return;
    seen.add(key);
    result.push({ classId: j.class_id, student: stu });
  });

  // Legacy class_id column path (pre-041 data)
  const { data: legacy } = await admin
    .from("students")
    .select("id, display_name, username, class_id")
    .in("class_id", classIds);
  (legacy ?? []).forEach(
    (s: StudentLite & { class_id: string }) => {
      const key = `${s.class_id}:${s.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({
        classId: s.class_id,
        student: { id: s.id, display_name: s.display_name, username: s.username },
      });
    }
  );

  return result;
}

// ============================================================================
// GET — list teacher's students grouped by class + demo state for this card
// ============================================================================
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    const admin = createAdminClient();

    // Validate the card exists (don't enforce ownership — any teacher can ack
    // against any published card or built-in).
    const { data: card } = await admin
      .from("skill_cards")
      .select("id, slug, is_published, is_built_in")
      .eq("id", cardId)
      .maybeSingle();
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const classes = await getTeacherClasses(admin, teacherId);
    if (classes.length === 0) {
      return NextResponse.json({ classes: [] });
    }

    const classIds = classes.map((c) => c.id);
    const pairs = await getStudentsInClasses(admin, classIds);
    const studentIds = [...new Set(pairs.map((p) => p.student.id))];

    // Fetch most-recent skill.demonstrated event per student for this card.
    // We need the latest one so DELETE can target it. Pull all events and
    // group by student in memory — simpler than a correlated subquery.
    const demosByStudent: Map<
      string,
      { event_id: string; created_at: string; payload: Record<string, unknown> }
    > = new Map();
    if (studentIds.length > 0) {
      const { data: events } = await admin
        .from("learning_events")
        .select("id, student_id, created_at, payload")
        .eq("subject_type", "skill_card")
        .eq("subject_id", cardId)
        .eq("event_type", "skill.demonstrated")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });
      (events ?? []).forEach(
        (e: {
          id: string;
          student_id: string;
          created_at: string;
          payload: Record<string, unknown>;
        }) => {
          // First one encountered is the most recent (we ordered desc).
          if (!demosByStudent.has(e.student_id)) {
            demosByStudent.set(e.student_id, {
              event_id: e.id,
              created_at: e.created_at,
              payload: e.payload,
            });
          }
        }
      );
    }

    // Group students by class. A student enrolled in multiple classes
    // appears under each class so the teacher can ack from any.
    const byClass: Record<
      string,
      {
        id: string;
        name: string;
        students: Array<{
          id: string;
          display_name: string;
          username: string;
          demonstrated_at: string | null;
          event_id: string | null;
          ack_by_teacher_id: string | null;
        }>;
      }
    > = Object.fromEntries(
      classes.map((c) => [
        c.id,
        { id: c.id, name: c.name, students: [] },
      ])
    );
    pairs.forEach(({ classId, student }) => {
      const bucket = byClass[classId];
      if (!bucket) return;
      const demo = demosByStudent.get(student.id);
      bucket.students.push({
        id: student.id,
        display_name: student.display_name,
        username: student.username,
        demonstrated_at: demo?.created_at ?? null,
        event_id: demo?.event_id ?? null,
        ack_by_teacher_id:
          (demo?.payload?.["ack_by_teacher_id"] as string | undefined) ?? null,
      });
    });

    // Sort students alphabetically within each class + classes by name
    Object.values(byClass).forEach((bucket) => {
      bucket.students.sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      );
    });
    const classesOut = Object.values(byClass).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({ classes: classesOut });
  } catch (error) {
    console.error(
      "[teacher/skills/cards/[id]/demonstrations:GET] Error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — write a skill.demonstrated event for a student
// ============================================================================
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    const body = (await request.json()) as { student_id?: string; note?: string };
    if (!body.student_id) {
      return NextResponse.json(
        { error: "student_id required" },
        { status: 400 }
      );
    }
    const studentId = body.student_id;
    const note = body.note?.toString().trim() || null;

    const admin = createAdminClient();

    // Validate card + student + teacher-owns-a-class-with-student
    const [{ data: card }, { data: student }] = await Promise.all([
      admin
        .from("skill_cards")
        .select("id, slug")
        .eq("id", cardId)
        .maybeSingle(),
      admin.from("students").select("id").eq("id", studentId).maybeSingle(),
    ]);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Teacher must own at least one class that contains this student.
    // Check junction first; fall back to legacy students.class_id.
    const classes = await getTeacherClasses(admin, teacherId);
    const classIds = classes.map((c) => c.id);
    let inOneOfTeacherClasses = false;
    if (classIds.length > 0) {
      const { data: junctionCheck } = await admin
        .from("class_students")
        .select("class_id")
        .eq("student_id", studentId)
        .eq("is_active", true)
        .in("class_id", classIds)
        .limit(1);
      if ((junctionCheck ?? []).length > 0) inOneOfTeacherClasses = true;
      if (!inOneOfTeacherClasses) {
        const { data: legacy } = await admin
          .from("students")
          .select("id, class_id")
          .eq("id", studentId)
          .maybeSingle();
        if (legacy?.class_id && classIds.includes(legacy.class_id)) {
          inOneOfTeacherClasses = true;
        }
      }
    }
    if (!inOneOfTeacherClasses) {
      return NextResponse.json(
        {
          error:
            "You can only ack demonstrations for students in your own classes.",
        },
        { status: 403 }
      );
    }

    // Dedupe: if there's a skill.demonstrated event for this (student, card)
    // in the last 24 hours, return the existing event rather than writing
    // a duplicate. Covers accidental double-taps + page reloads.
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: recent } = await admin
      .from("learning_events")
      .select("id, created_at")
      .eq("student_id", studentId)
      .eq("subject_type", "skill_card")
      .eq("subject_id", cardId)
      .eq("event_type", "skill.demonstrated")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      return NextResponse.json({
        event_id: recent.id,
        created_at: recent.created_at,
        dedupe: true,
      });
    }

    const { data: inserted, error: insertError } = await admin
      .from("learning_events")
      .insert({
        student_id: studentId,
        event_type: "skill.demonstrated",
        subject_type: "skill_card",
        subject_id: cardId,
        payload: {
          ack_by_teacher_id: teacherId,
          ack_source: "teacher_ui",
          card_slug: card.slug,
          note,
        },
      })
      .select("id, created_at")
      .single();
    if (insertError || !inserted) {
      console.error(
        "[teacher/skills/cards/[id]/demonstrations:POST] Insert error:",
        insertError
      );
      return NextResponse.json(
        { error: "Failed to write demonstration event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      event_id: inserted.id,
      created_at: inserted.created_at,
      dedupe: false,
    });
  } catch (error) {
    console.error(
      "[teacher/skills/cards/[id]/demonstrations:POST] Error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — revoke the most recent skill.demonstrated for (student, card)
// ============================================================================
// learning_events is nominally append-only (no UPDATE/DELETE for students
// per migration 106 RLS), but teacher-side corrections are a real need —
// a teacher taps the wrong student, or a student is asked to re-demo.
// Admin-client bypasses RLS; teacher ownership is enforced in code.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    const body = (await request.json().catch(() => ({}))) as {
      student_id?: string;
    };
    if (!body.student_id) {
      return NextResponse.json(
        { error: "student_id required" },
        { status: 400 }
      );
    }
    const studentId = body.student_id;

    const admin = createAdminClient();

    // Teacher must own a class with this student (same check as POST).
    const classes = await getTeacherClasses(admin, teacherId);
    const classIds = classes.map((c) => c.id);
    let allowed = false;
    if (classIds.length > 0) {
      const { data: junctionCheck } = await admin
        .from("class_students")
        .select("class_id")
        .eq("student_id", studentId)
        .eq("is_active", true)
        .in("class_id", classIds)
        .limit(1);
      if ((junctionCheck ?? []).length > 0) allowed = true;
      if (!allowed) {
        const { data: legacy } = await admin
          .from("students")
          .select("id, class_id")
          .eq("id", studentId)
          .maybeSingle();
        if (legacy?.class_id && classIds.includes(legacy.class_id)) {
          allowed = true;
        }
      }
    }
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "You can only revoke demonstrations for students in your own classes.",
        },
        { status: 403 }
      );
    }

    // Locate most recent demonstrated event, verify it was the teacher's ack
    // (payload.ack_by_teacher_id = teacherId), and delete it. We don't let a
    // teacher delete another teacher's ack — the student may have two
    // teachers and we respect each teacher's record.
    const { data: event } = await admin
      .from("learning_events")
      .select("id, payload")
      .eq("student_id", studentId)
      .eq("subject_type", "skill_card")
      .eq("subject_id", cardId)
      .eq("event_type", "skill.demonstrated")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!event) {
      return NextResponse.json(
        { error: "No demonstration event found to revoke." },
        { status: 404 }
      );
    }
    const ackBy =
      (event.payload as Record<string, unknown>)?.["ack_by_teacher_id"] ?? null;
    if (ackBy && ackBy !== teacherId) {
      return NextResponse.json(
        {
          error:
            "This demonstration was acked by a different teacher — only they can revoke it.",
        },
        { status: 403 }
      );
    }

    const { error: deleteError } = await admin
      .from("learning_events")
      .delete()
      .eq("id", event.id);
    if (deleteError) {
      console.error(
        "[teacher/skills/cards/[id]/demonstrations:DELETE] Delete error:",
        deleteError
      );
      return NextResponse.json(
        { error: "Failed to revoke demonstration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ revoked_event_id: event.id });
  } catch (error) {
    console.error(
      "[teacher/skills/cards/[id]/demonstrations:DELETE] Error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
