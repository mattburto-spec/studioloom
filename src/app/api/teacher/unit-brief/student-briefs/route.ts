// Unit Briefs Foundation Phase F.E — teacher review of per-student
// brief authoring.
//
// GET /api/teacher/unit-brief/student-briefs?unitId=<uuid>
//   → { studentBriefs: Array<{ student_id, student_name,
//                              brief_text, constraints,
//                              diagram_url, updated_at,
//                              choice_card_id, choice_card_label }> }
//
// Lists every student_briefs row for a unit, enriched with the
// student's display name and (when available) their picked choice
// card so the teacher knows which template they were authoring
// against.
//
// Auth: requireTeacher → verifyTeacherHasUnit (hasAccess — author OR
// co-teacher). Service-role admin client for the read. RLS policy on
// student_briefs already enforces the same chain when teachers query
// directly; using admin + verify keeps the contract symmetric with
// the rest of the unit-brief routes.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { verifyTeacherHasUnit } from "@/lib/auth/verify-teacher-unit";
import { coerceConstraints } from "@/lib/unit-brief/validators";
import type { UnitBriefConstraints } from "@/types/unit-brief";

interface StudentBriefRow {
  student_id: string;
  student_name: string;
  brief_text: string | null;
  constraints: UnitBriefConstraints;
  diagram_url: string | null;
  updated_at: string;
  /** Card slug the student picked for this unit, if any. */
  choice_card_id: string | null;
  /** Display label of that card. */
  choice_card_label: string | null;
}

export const GET = withErrorHandler(
  "teacher/unit-brief-student-briefs:GET",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId query parameter required" },
        { status: 400 },
      );
    }

    const access = await verifyTeacherHasUnit(teacherId, unitId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = createAdminClient();

    // ─── 1. Fetch all student_briefs rows for this unit ────────────────
    const { data: rows, error } = await db
      .from("student_briefs")
      .select(
        "student_id, brief_text, constraints, diagram_url, updated_at",
      )
      .eq("unit_id", unitId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ studentBriefs: [] });
    }

    const studentIds = Array.from(
      new Set(rows.map((r) => r.student_id as string)),
    );

    // ─── 2. Enrich with student display names (1 query) ────────────────
    const { data: students } = await db
      .from("students")
      .select("id, display_name, username")
      .in("id", studentIds);

    const studentNameById = new Map<string, string>(
      (students ?? []).map((s) => [
        s.id as string,
        (s.display_name as string | null) ||
          (s.username as string | null) ||
          "Student",
      ]),
    );

    // ─── 3. Enrich with choice card picks (1 query) ────────────────────
    // Latest pick per student for this unit — same shape as the
    // resolver, batched. _pitch-your-own picks pass through (label
    // synthesised) so teachers can see which students opted to pitch
    // their own scenario.
    const { data: picks } = await db
      .from("choice_card_selections")
      .select("student_id, card_id, picked_at")
      .eq("unit_id", unitId)
      .in("student_id", studentIds)
      .order("picked_at", { ascending: false });

    // Latest pick wins per student (first row in DESC order per id).
    const pickByStudent = new Map<string, string>();
    for (const p of picks ?? []) {
      const sid = p.student_id as string;
      if (!pickByStudent.has(sid)) {
        pickByStudent.set(sid, p.card_id as string);
      }
    }
    const cardIds = Array.from(new Set(pickByStudent.values())).filter(
      (id) => id !== "_pitch-your-own",
    );

    const cardLabelById = new Map<string, string>();
    if (cardIds.length > 0) {
      const { data: cards } = await db
        .from("choice_cards")
        .select("id, label")
        .in("id", cardIds);
      for (const c of cards ?? []) {
        cardLabelById.set(c.id as string, c.label as string);
      }
    }
    cardLabelById.set("_pitch-your-own", "Pitching their own");

    // ─── 4. Assemble + return ──────────────────────────────────────────
    const studentBriefs: StudentBriefRow[] = rows.map((r) => {
      const sid = r.student_id as string;
      const pickedCard = pickByStudent.get(sid) ?? null;
      return {
        student_id: sid,
        student_name: studentNameById.get(sid) ?? "Student",
        brief_text: (r.brief_text as string | null) ?? null,
        constraints: coerceConstraints(r.constraints),
        diagram_url: (r.diagram_url as string | null) ?? null,
        updated_at: r.updated_at as string,
        choice_card_id: pickedCard,
        choice_card_label: pickedCard ? cardLabelById.get(pickedCard) ?? null : null,
      };
    });

    return NextResponse.json({ studentBriefs });
  },
);
