// audit-skip: Project Spec v2 — Success Criteria student-side CRUD via
// token session. Storage in student_unit_success_criteria (per-student,
// per-unit). Partial-patch upsert pattern. Service-role API +
// studentId from token session — no RLS path for writes (Lesson #4).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { resolveChoiceCardPickForUnit } from "@/lib/choice-cards/resolve-for-unit";

const SLOT_COLUMNS = [
  "slot_1",
  "slot_2",
  "slot_3",
  "slot_4",
  "slot_5",
] as const;

const COLUMNS_RETURNED =
  "slot_1, slot_2, slot_3, slot_4, slot_5, completed_at, class_id";

/**
 * GET /api/student/success-criteria?unitId=<uuid>
 *
 * Returns the student's Success Criteria for a unit, or empty initial state.
 */
export const GET = withErrorHandler(
  "student/success-criteria:GET",
  async (request: NextRequest) => {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId query parameter required" },
        { status: 400 },
      );
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from("student_unit_success_criteria")
      .select(COLUMNS_RETURNED)
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Surface the student's most recent Choice Cards pick for this unit
    // so the UI can render a contextual "From your card pick" banner.
    // Success Criteria is universal — no archetype to pre-fill, but the
    // banner is still useful orientation.
    const pick = await resolveChoiceCardPickForUnit(db, studentId, unitId);
    const from_choice_card = pick ? { cardId: pick.cardId, label: pick.label } : null;

    return NextResponse.json({ criteria: data ?? emptyCriteria(), from_choice_card });
  },
);

/**
 * POST /api/student/success-criteria
 *
 * Body: { unitId, slot_1?..slot_5?, completed? }
 * Partial-patch upsert. Server merges with existing row.
 */
export const POST = withErrorHandler(
  "student/success-criteria:POST",
  async (request: NextRequest) => {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "body must be an object" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    if (typeof b.unitId !== "string" || b.unitId.length === 0) {
      return NextResponse.json(
        { error: "unitId required (string)" },
        { status: 400 },
      );
    }
    const unitId = b.unitId;

    const patch: Record<string, unknown> = {};
    for (const col of SLOT_COLUMNS) {
      if (col in b) {
        const v = b[col];
        if (v === null) {
          patch[col] = null;
        } else if (typeof v === "object" && !Array.isArray(v)) {
          const slot = v as Record<string, unknown>;
          if (typeof slot.skipped !== "boolean") {
            return NextResponse.json(
              { error: `${col}.skipped must be a boolean` },
              { status: 400 },
            );
          }
          if (typeof slot.updated_at !== "string") {
            return NextResponse.json(
              { error: `${col}.updated_at must be an ISO string` },
              { status: 400 },
            );
          }
          patch[col] = v;
        } else {
          return NextResponse.json(
            { error: `${col} must be a slot-answer object or null` },
            { status: 400 },
          );
        }
      }
    }

    if (b.completed === true) {
      patch.completed_at = new Date().toISOString();
    }
    // "Reopen to revise" — clears completion so the student can re-enter
    // the walker without resetting their slot answers.
    if (b.reopen === true) {
      patch.completed_at = null;
    }

    const db = createAdminClient();

    const { data: existing } = await db
      .from("student_unit_success_criteria")
      .select(COLUMNS_RETURNED)
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    const merged = {
      student_id: studentId,
      unit_id: unitId,
      ...(existing ?? emptyCriteria()),
      ...patch,
    };

    const { data, error } = await db
      .from("student_unit_success_criteria")
      .upsert(merged, { onConflict: "student_id,unit_id" })
      .select(COLUMNS_RETURNED)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save success criteria" },
        { status: 500 },
      );
    }

    return NextResponse.json({ criteria: data });
  },
);

function emptyCriteria() {
  return {
    slot_1: null,
    slot_2: null,
    slot_3: null,
    slot_4: null,
    slot_5: null,
    completed_at: null,
    class_id: null,
  };
}
