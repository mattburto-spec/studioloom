// audit-skip: AG.4.1 — read-only teacher panel data, no mutations.
/**
 * AG.4.1 — GET /api/teacher/student-attention?unitId=X&classId=Y
 *
 * Aggregates per-student "needs attention" signals for the Teacher
 * Attention-Rotation Panel. Read-only.
 *
 * Auth: requireTeacherAuth + verifyTeacherOwnsClass (mirrors the rest of
 * /api/teacher/* — Phase 3.4 shim).
 *
 * Data sources (all read via service-role admin client; route is the
 * authorisation boundary):
 *   - class_students + students     → roster for the class
 *   - portfolio_entries             → last `type='auto'` entry per student
 *                                       (= last journal save, since AG.1
 *                                       structured-prompts persists there)
 *   - student_unit_kanban           → last_move_at column (AG.2.1)
 *   - competency_assessments        → Three Cs ratings + last teacher
 *                                       observation (= last calibration)
 *
 * Pure aggregation logic lives in `@/lib/unit-tools/attention/aggregate.ts`
 * so the route stays a thin DB → buildAttentionPanel call. Per Lesson #71.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";
import {
  buildAttentionPanel,
  type CompetencyAssessmentLike,
} from "@/lib/unit-tools/attention/aggregate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withErrorHandler(
  "teacher/student-attention:GET",
  async (request: NextRequest) => {
    // 1. Auth
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    // 2. Parse + validate query params
    const url = new URL(request.url);
    const unitId = url.searchParams.get("unitId");
    const classId = url.searchParams.get("classId");
    if (!unitId || !UUID_RE.test(unitId)) {
      return NextResponse.json(
        { error: "unitId required and must be UUID" },
        { status: 400 }
      );
    }
    if (!classId || !UUID_RE.test(classId)) {
      return NextResponse.json(
        { error: "classId required and must be UUID" },
        { status: 400 }
      );
    }

    // 3. Authorise — teacher owns this class
    const ownsClass = await verifyTeacherOwnsClass(teacherId, classId);
    if (!ownsClass) {
      return NextResponse.json(
        { error: "Forbidden: not your class" },
        { status: 403 }
      );
    }

    const db = createAdminClient();

    // 4. Class roster
    const { data: junctionRows } = await db
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId);
    const studentIds = (junctionRows || []).map(
      (r: { student_id: string }) => r.student_id
    );

    if (studentIds.length === 0) {
      return NextResponse.json({
        unitId,
        classId,
        nowIso: new Date().toISOString(),
        rows: [],
      });
    }

    const { data: studentsData } = await db
      .from("students")
      .select("id, display_name, username")
      .in("id", studentIds);
    const students = (studentsData || []).map(
      (s: { id: string; display_name: string | null; username: string }) => ({
        studentId: s.id,
        displayName: s.display_name?.trim() || s.username,
      })
    );

    // 5. Per-student last-journal timestamp from portfolio_entries (type=auto)
    const journalByStudent: Record<string, string | null> = {};
    {
      const { data: rows } = await db
        .from("portfolio_entries")
        .select("student_id, created_at")
        .eq("unit_id", unitId)
        .eq("type", "auto")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });
      for (const r of rows || []) {
        const sid = (r as { student_id: string }).student_id;
        const ts = (r as { created_at: string }).created_at;
        if (journalByStudent[sid] === undefined) {
          journalByStudent[sid] = ts;
        }
      }
    }

    // 6. Per-student last_move_at + denormalized counts from student_unit_kanban.
    //    Counts power the at-a-glance "is this student using their project
    //    board?" pulse check shown alongside the timestamp.
    const kanbanMoveByStudent: Record<string, string | null> = {};
    const kanbanCountsByStudent: Record<
      string,
      { total: number; done: number }
    > = {};
    {
      const { data: rows } = await db
        .from("student_unit_kanban")
        .select(
          "student_id, last_move_at, backlog_count, this_class_count, doing_count, done_count"
        )
        .eq("unit_id", unitId)
        .in("student_id", studentIds);
      for (const r of rows || []) {
        const row = r as {
          student_id: string;
          last_move_at: string | null;
          backlog_count: number;
          this_class_count: number;
          doing_count: number;
          done_count: number;
        };
        kanbanMoveByStudent[row.student_id] = row.last_move_at;
        kanbanCountsByStudent[row.student_id] = {
          total:
            row.backlog_count +
            row.this_class_count +
            row.doing_count +
            row.done_count,
          done: row.done_count,
        };
      }
    }

    // 7. Per-student competency_assessments rows for unit (Three Cs + calibration)
    const competencyByStudent: Record<string, CompetencyAssessmentLike[]> = {};
    {
      const { data: rows } = await db
        .from("competency_assessments")
        .select("student_id, competency, rating, source, created_at")
        .eq("unit_id", unitId)
        .in("student_id", studentIds);
      for (const r of rows || []) {
        const row = r as {
          student_id: string;
          competency: string;
          rating: number;
          source: "student_self" | "teacher_observation";
          created_at: string;
        };
        if (!competencyByStudent[row.student_id]) {
          competencyByStudent[row.student_id] = [];
        }
        competencyByStudent[row.student_id].push({
          competency: row.competency,
          rating: row.rating,
          source: row.source,
          created_at: row.created_at,
        });
      }
    }

    // 8. Pure aggregation
    const payload = buildAttentionPanel({
      unitId,
      classId,
      nowIso: new Date().toISOString(),
      students,
      journalByStudent,
      kanbanMoveByStudent,
      kanbanCountsByStudent,
      competencyByStudent,
    });

    return NextResponse.json(payload);
  }
);
