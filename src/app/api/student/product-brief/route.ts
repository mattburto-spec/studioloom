// audit-skip: Project Spec v2 — Product Brief student-side CRUD via
// token session. Storage in student_unit_product_briefs (per-student,
// per-unit). Partial-patch upsert pattern (server merges patch with
// existing row). Service-role API + studentId from token session —
// no RLS path needed for student writes (Lesson #4).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { PRODUCT_BRIEF_ARCHETYPES } from "@/lib/project-spec/product-brief";
import {
  resolveChoiceCardPickForUnit,
  extractArchetypeId,
} from "@/lib/choice-cards/resolve-for-unit";

const SLOT_COLUMNS = [
  "slot_1",
  "slot_2",
  "slot_3",
  "slot_4",
  "slot_5",
  "slot_6",
  "slot_7",
  "slot_8",
  "slot_9",
] as const;

const COLUMNS_RETURNED =
  "archetype_id, slot_1, slot_2, slot_3, slot_4, slot_5, slot_6, slot_7, slot_8, slot_9, completed_at, class_id";

/**
 * GET /api/student/product-brief?unitId=<uuid>
 *
 * Returns the student's Product Brief for a unit. If no row exists yet,
 * returns an empty initial state (UI uses this to dispatch to the
 * archetype-picker phase rather than show an error).
 */
export const GET = withErrorHandler(
  "student/product-brief:GET",
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
      .from("student_unit_product_briefs")
      .select(COLUMNS_RETURNED)
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const brief = data ?? emptyBrief();

    // Lazy resolve archetype_id from a Choice Cards pick if the brief
    // hasn't yet committed to one. Suggested-not-persisted: the next
    // POST that includes archetype_id will write it for real. Also
    // surface `from_choice_card` so the UI can render a contextual
    // "From your card pick" banner.
    let from_choice_card: { cardId: string; label: string } | null = null;
    if (!brief.archetype_id) {
      const pick = await resolveChoiceCardPickForUnit(db, studentId, unitId);
      const suggestedArchetypeId = extractArchetypeId(pick);
      if (pick && suggestedArchetypeId && PRODUCT_BRIEF_ARCHETYPES[suggestedArchetypeId]) {
        brief.archetype_id = suggestedArchetypeId;
        from_choice_card = { cardId: pick.cardId, label: pick.label };
      } else if (pick) {
        // Pick exists but action isn't a set-archetype the brief recognises.
        // Surface the banner anyway — useful context for the student.
        from_choice_card = { cardId: pick.cardId, label: pick.label };
      }
    }

    return NextResponse.json({ brief, from_choice_card });
  },
);

/**
 * POST /api/student/product-brief
 *
 * Body: { unitId: string, archetype_id?, slot_1?..slot_9?, completed? }
 *
 * Partial-patch upsert. Server merges the patch with the existing row
 * (or creates an empty one) and writes atomically. Only fields explicitly
 * present in the body are touched.
 *
 * `completed: true` sets completed_at = now() server-side. Once completed,
 * the row may still be re-completed (idempotent).
 */
export const POST = withErrorHandler(
  "student/product-brief:POST",
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

    if ("archetype_id" in b) {
      if (b.archetype_id === null) {
        patch.archetype_id = null;
      } else if (
        typeof b.archetype_id === "string" &&
        PRODUCT_BRIEF_ARCHETYPES[b.archetype_id]
      ) {
        patch.archetype_id = b.archetype_id;
      } else {
        return NextResponse.json(
          {
            error: `archetype_id must be one of: ${Object.keys(
              PRODUCT_BRIEF_ARCHETYPES,
            ).join(", ")}`,
          },
          { status: 400 },
        );
      }
    }

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
      .from("student_unit_product_briefs")
      .select(COLUMNS_RETURNED)
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    const merged = {
      student_id: studentId,
      unit_id: unitId,
      ...(existing ?? emptyBrief()),
      ...patch,
    };

    const { data, error } = await db
      .from("student_unit_product_briefs")
      .upsert(merged, { onConflict: "student_id,unit_id" })
      .select(COLUMNS_RETURNED)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save product brief" },
        { status: 500 },
      );
    }

    return NextResponse.json({ brief: data });
  },
);

function emptyBrief() {
  return {
    archetype_id: null,
    slot_1: null,
    slot_2: null,
    slot_3: null,
    slot_4: null,
    slot_5: null,
    slot_6: null,
    slot_7: null,
    slot_8: null,
    slot_9: null,
    completed_at: null,
    class_id: null,
  };
}
