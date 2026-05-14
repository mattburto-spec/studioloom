// audit-skip: Unit Briefs Foundation Phase B.1 MVP. Teacher CRUD on
// their own unit-level brief + constraints is pedagogical content
// authoring — same audit-sensitivity class as the v2 product-brief-pitch
// route which is also audit-skipped. The unit AUTHOR is the only
// writer (verifyTeacherHasUnit.isAuthor gates POST). Audit logging
// tracked as FU-BRIEFS-AUDIT-COVERAGE once the workflow proves out.
//
// Unit Briefs Foundation Phase B.1 — teacher CRUD for the unit-level
// brief + constraints. One row per unit (unit_id PK). Author-only
// writes; author + co-teachers may read. Service-role admin client
// mints all DB calls — no RLS write policy is needed (mirrors v2
// product-brief-pitch pattern).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { verifyTeacherHasUnit } from "@/lib/auth/verify-teacher-unit";
import type { UnitBrief } from "@/types/unit-brief";
// Phase F.C — validators + coercers extracted to a shared module so
// the choice-cards routes can reuse the exact same validation/coercion
// for their brief template fields. See src/lib/unit-brief/validators.ts.
import {
  GENERIC_CONSTRAINTS,
  coerceConstraints,
  coerceLocks,
  validateConstraints,
  validateLocks,
} from "@/lib/unit-brief/validators";

const COLUMNS_RETURNED =
  "unit_id, brief_text, constraints, diagram_url, locks, created_at, updated_at, created_by";

function rowToBrief(row: Record<string, unknown>): UnitBrief {
  return {
    unit_id: row.unit_id as string,
    brief_text: (row.brief_text as string | null) ?? null,
    constraints: coerceConstraints(row.constraints),
    diagram_url: (row.diagram_url as string | null) ?? null,
    locks: coerceLocks(row.locks),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    created_by: (row.created_by as string | null) ?? null,
  };
}

/**
 * GET /api/teacher/unit-brief?unitId=<uuid>
 *
 * Returns the unit's brief. Author + co-teachers may read. Returns
 * `{ brief: null }` if no brief has been authored yet (the editor uses
 * this to render an empty initial state instead of an error).
 */
export const GET = withErrorHandler(
  "teacher/unit-brief:GET",
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
    const { data, error } = await db
      .from("unit_briefs")
      .select(COLUMNS_RETURNED)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ brief: data ? rowToBrief(data) : null });
  },
);

/**
 * POST /api/teacher/unit-brief
 *
 * Body: { unitId: string, brief_text?: string | null, constraints?: UnitBriefConstraints }
 *
 * Partial-patch upsert. Server merges the patch with the existing row
 * (or creates a new one) and writes atomically. Only fields explicitly
 * present in the body are touched — clients can save just brief_text
 * without resending constraints, and vice versa.
 *
 * Only the unit AUTHOR may write. Co-teachers can read but not edit.
 */
export const POST = withErrorHandler(
  "teacher/unit-brief:POST",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "body must be an object" },
        { status: 400 },
      );
    }
    const b = body as Record<string, unknown>;

    if (typeof b.unitId !== "string" || b.unitId.length === 0) {
      return NextResponse.json(
        { error: "unitId required (string)" },
        { status: 400 },
      );
    }
    const unitId = b.unitId;

    const access = await verifyTeacherHasUnit(teacherId, unitId);
    if (!access.isAuthor) {
      return NextResponse.json(
        { error: "Only the unit author can edit the brief" },
        { status: 403 },
      );
    }

    const patch: Record<string, unknown> = {};

    if ("brief_text" in b) {
      if (b.brief_text === null) {
        patch.brief_text = null;
      } else if (typeof b.brief_text === "string") {
        patch.brief_text = b.brief_text;
      } else {
        return NextResponse.json(
          { error: "brief_text must be a string or null" },
          { status: 400 },
        );
      }
    }

    if ("constraints" in b) {
      const validated = validateConstraints(b.constraints);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      patch.constraints = validated.value;
    }

    if ("locks" in b) {
      const validated = validateLocks(b.locks);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      patch.locks = validated.value;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "body must include at least one of: brief_text, constraints, locks" },
        { status: 400 },
      );
    }

    const db = createAdminClient();

    const { data: existing } = await db
      .from("unit_briefs")
      .select(COLUMNS_RETURNED)
      .eq("unit_id", unitId)
      .maybeSingle();

    const merged: Record<string, unknown> = existing
      ? { ...existing, ...patch }
      : {
          unit_id: unitId,
          brief_text: null,
          constraints: GENERIC_CONSTRAINTS,
          created_by: teacherId,
          ...patch,
        };

    const { data, error } = await db
      .from("unit_briefs")
      .upsert(merged, { onConflict: "unit_id" })
      .select(COLUMNS_RETURNED)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save unit brief" },
        { status: 500 },
      );
    }

    return NextResponse.json({ brief: rowToBrief(data) });
  },
);
