/**
 * POST /api/teacher/grading/resolve-thread
 *
 * TFL.3 C.3.3. Persists the teacher's "Mark resolved" intent for an
 * inbox thread. Updates student_tile_grades.resolved_at + resolved_by
 * so the resolution survives across devices (school ↔ home) — the
 * earlier localStorage-only approach was per-browser-per-machine.
 *
 * Auth: requireTeacher (security-overview.md hard rule). Verifies the
 * teacher owns the class containing the grade row before any UPDATE.
 *
 * Body:
 *   { grade_id: string }
 *
 * Response:
 *   { ok: true, resolvedAt: string (ISO) }
 *
 * Re-surface semantics: a NEW student reply after resolved_at will
 * re-open the thread on the loader side (see inbox-loader). This
 * route just stamps resolved_at = NOW(); the loader compares against
 * latest_student_reply.sent_at to decide visibility.
 *
 * Also accepts grade_id for an UNDO path (resolved=false): clears the
 * columns. Used by an "Undo resolve" link surfaced by the inbox toast.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/access-v2/audit-log";

interface PostBody {
  grade_id?: string;
  /** When false, CLEAR resolved_at instead of setting it. Default true. */
  resolved?: boolean;
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const gradeId = body.grade_id;
  if (!gradeId) {
    return NextResponse.json(
      { error: "grade_id required" },
      { status: 400 },
    );
  }
  const wantResolved = body.resolved !== false; // default = mark resolved

  const db = createAdminClient();

  // 1. Load grade + verify teacher ownership in one query.
  const { data: gradeRow, error: gErr } = await db
    .from("student_tile_grades")
    .select(
      "id, student_id, class_id, unit_id, page_id, tile_id, classes(teacher_id)",
    )
    .eq("id", gradeId)
    .maybeSingle();
  if (gErr || !gradeRow) {
    return NextResponse.json(
      { error: gErr?.message ?? "Grade not found" },
      { status: 404 },
    );
  }
  const grade = gradeRow as unknown as {
    id: string;
    student_id: string;
    class_id: string;
    unit_id: string;
    page_id: string;
    tile_id: string;
    classes: { teacher_id: string } | { teacher_id: string }[] | null;
  };
  const klass = Array.isArray(grade.classes) ? grade.classes[0] : grade.classes;
  if (!klass || klass.teacher_id !== teacherId) {
    return NextResponse.json(
      { error: "Forbidden — grade belongs to another teacher" },
      { status: 403 },
    );
  }

  // 2. UPDATE the resolution columns.
  const resolvedAt = wantResolved ? new Date().toISOString() : null;
  const { error: uErr } = await db
    .from("student_tile_grades")
    .update({
      resolved_at: resolvedAt,
      resolved_by: wantResolved ? teacherId : null,
    })
    .eq("id", gradeId);
  if (uErr) {
    return NextResponse.json(
      { error: `Update failed: ${uErr.message}` },
      { status: 500 },
    );
  }

  // 3. Audit log. soft-sentry so a logging hiccup doesn't roll back
  // the resolution — the resolve_at column is the source of truth.
  await logAuditEvent(db, {
    actorId: teacherId,
    actorType: "teacher",
    action: wantResolved
      ? "grading.thread_resolved"
      : "grading.thread_resolve_undone",
    targetTable: "student_tile_grades",
    targetId: gradeId,
    severity: "info",
    payload: {
      grade_id: gradeId,
      student_id: grade.student_id,
      class_id: grade.class_id,
      tile_id: grade.tile_id,
      resolved_at: resolvedAt,
    },
    failureMode: "soft-sentry",
  });

  return NextResponse.json({ ok: true, resolvedAt }, { status: 200 });
}
