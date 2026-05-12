// audit-skip: Project Spec v1 — student-side CRUD via token session.
// Storage in student_unit_project_specs (per-student, per-unit).
// Partial-patch upsert pattern (server merges patch with existing row).
// Service-role API + studentId from token session — no RLS path needed
// for student writes (Lesson #4).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { ARCHETYPES } from "@/lib/project-spec/archetypes";

const SLOT_COLUMNS = [
  "slot_1",
  "slot_2",
  "slot_3",
  "slot_4",
  "slot_5",
  "slot_6",
  "slot_7",
] as const;

const COLUMNS_RETURNED =
  "archetype_id, slot_1, slot_2, slot_3, slot_4, slot_5, slot_6, slot_7, completed_at, class_id";

/**
 * GET /api/student/project-spec?unitId=<uuid>
 *
 * Returns the student's Project Spec state for a unit. If no row exists
 * yet, returns an empty initial state (UI uses this to dispatch to the
 * archetype-picker phase rather than show an error).
 */
export const GET = withErrorHandler(
  "student/project-spec:GET",
  async (request: NextRequest) => {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId query parameter required" },
        { status: 400 }
      );
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from("student_unit_project_specs")
      .select(COLUMNS_RETURNED)
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ spec: data ?? emptySpec() });
  }
);

/**
 * POST /api/student/project-spec
 *
 * Body: { unitId: string, archetype_id?, slot_1?..slot_7?, completed? }
 *
 * Partial-patch upsert. Server merges the patch with the existing row
 * (or creates an empty one) and writes atomically. Only fields explicitly
 * present in the body are touched — others retain their prior value.
 *
 * `completed: true` sets completed_at = now() server-side. Once completed,
 * the row may still be re-completed (idempotent) but un-completion is not
 * supported in v1.
 */
export const POST = withErrorHandler(
  "student/project-spec:POST",
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
        { status: 400 }
      );
    }
    const unitId = b.unitId;

    // Build the patch — only include fields explicitly present
    const patch: Record<string, unknown> = {};

    if ("archetype_id" in b) {
      if (b.archetype_id === null) {
        patch.archetype_id = null;
      } else if (typeof b.archetype_id === "string" && ARCHETYPES[b.archetype_id]) {
        patch.archetype_id = b.archetype_id;
      } else {
        return NextResponse.json(
          { error: `archetype_id must be one of: ${Object.keys(ARCHETYPES).join(", ")}` },
          { status: 400 }
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
              { status: 400 }
            );
          }
          if (typeof slot.updated_at !== "string") {
            return NextResponse.json(
              { error: `${col}.updated_at must be an ISO string` },
              { status: 400 }
            );
          }
          patch[col] = v;
        } else {
          return NextResponse.json(
            { error: `${col} must be a slot-answer object or null` },
            { status: 400 }
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

    // Upsert with merge-on-conflict. We fetch first to preserve fields
    // not present in the patch (Supabase upsert REPLACES the row by default).
    const { data: existing } = await db
      .from("student_unit_project_specs")
      .select(COLUMNS_RETURNED)
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    const merged = {
      student_id: studentId,
      unit_id: unitId,
      ...(existing ?? emptySpec()),
      ...patch,
    };

    const { data, error } = await db
      .from("student_unit_project_specs")
      .upsert(merged, { onConflict: "student_id,unit_id" })
      .select(COLUMNS_RETURNED)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save project spec" },
        { status: 500 }
      );
    }

    return NextResponse.json({ spec: data });
  }
);

function emptySpec() {
  return {
    archetype_id: null,
    slot_1: null,
    slot_2: null,
    slot_3: null,
    slot_4: null,
    slot_5: null,
    slot_6: null,
    slot_7: null,
    completed_at: null,
    class_id: null,
  };
}
