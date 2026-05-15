// audit-skip: Unit Briefs Foundation Phase F.D — student authoring of
// their own brief (over unlocked fields) is pedagogical content
// authoring keyed to the student's session. The student_id + unit_id
// FK chain + service-role-only write path constrain the write surface.
// Same audit-class as the rest of the briefs build (FU-BRIEFS-AUDIT-
// COVERAGE retrofit will sweep all 4 audit-skipped POSTs together).
//
// Unit Briefs Foundation Phase C.1 + F.D — student-side read endpoint +
// per-student override authoring.
//
// GET /api/student/unit-brief?unitId=<uuid>
//   → { brief: UnitBrief | null,
//       amendments: UnitBriefAmendment[],
//       cardTemplate: { brief_text, brief_constraints, brief_locks,
//                       cardId, cardLabel } | null,
//       studentBrief: StudentBrief | null }
// Returns the 3 sources separately so the client can compute the
// effective brief (merge + locks precedence). See
// src/lib/unit-brief/effective.ts.
//
// POST /api/student/unit-brief (Phase F.D)
// Body: { unitId, brief_text?, constraints? }
//   → { studentBrief: StudentBrief }
// Upserts the student's per-unit override row. brief_text / constraints
// fall through to the template at render time when not overridden.
//
// Auth: token-session via requireStudentSession (Lesson #4 — students
// don't use Supabase Auth). All DB ops go through the service-role
// admin client.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { resolveChoiceCardPickForUnit } from "@/lib/choice-cards/resolve-for-unit";
import {
  coerceConstraints,
  coerceLocks,
  validateConstraints,
} from "@/lib/unit-brief/validators";
import type {
  StudentBrief,
  UnitBrief,
  UnitBriefAmendment,
  UnitBriefConstraints,
  UnitBriefLocks,
} from "@/types/unit-brief";

const BRIEF_COLUMNS =
  "unit_id, brief_text, constraints, diagram_url, locks, created_at, updated_at, created_by";
const AMENDMENT_COLUMNS =
  "id, unit_id, version_label, title, body, created_at, created_by";
const STUDENT_BRIEF_COLUMNS =
  "id, student_id, unit_id, brief_text, constraints, diagram_url, created_at, updated_at";
const CARD_BRIEF_COLUMNS =
  "id, label, brief_text, brief_constraints, brief_locks";

interface CardTemplate {
  cardId: string;
  cardLabel: string;
  brief_text: string | null;
  brief_constraints: UnitBriefConstraints;
  brief_locks: UnitBriefLocks;
}

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

function rowToAmendment(row: Record<string, unknown>): UnitBriefAmendment {
  return {
    id: row.id as string,
    unit_id: row.unit_id as string,
    version_label: row.version_label as string,
    title: row.title as string,
    body: row.body as string,
    created_at: row.created_at as string,
    created_by: (row.created_by as string | null) ?? null,
  };
}

function rowToStudentBrief(row: Record<string, unknown>): StudentBrief {
  return {
    id: row.id as string,
    student_id: row.student_id as string,
    unit_id: row.unit_id as string,
    brief_text: (row.brief_text as string | null) ?? null,
    constraints: coerceConstraints(row.constraints),
    diagram_url: (row.diagram_url as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Verify the student is enrolled in an active class that has this unit
 * assigned. Returns null on success, a NextResponse on failure (403).
 * Same chain as /api/student/unit/route.ts + Phase C original.
 */
async function verifyEnrollment(
  db: ReturnType<typeof createAdminClient>,
  studentId: string,
  unitId: string,
): Promise<NextResponse | null> {
  const { data: enrollments } = await db
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true);

  const activeClassIds = new Set<string>(
    (enrollments ?? []).map((e) => e.class_id as string),
  );

  const { data: student } = await db
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .single();
  if (student?.class_id) activeClassIds.add(student.class_id as string);

  if (activeClassIds.size === 0) {
    return NextResponse.json(
      { error: "Not enrolled in any active class" },
      { status: 403 },
    );
  }

  const { data: assigned } = await db
    .from("class_units")
    .select("class_id")
    .in("class_id", Array.from(activeClassIds))
    .eq("unit_id", unitId)
    .eq("is_active", true)
    .limit(1);

  if (!assigned || assigned.length === 0) {
    return NextResponse.json(
      { error: "Unit not assigned to your class" },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
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
  const denied = await verifyEnrollment(db, studentId, unitId);
  if (denied) return denied;

  // ─── 1. brief + amendments + student_brief in parallel ──────────────
  const [
    { data: briefRow, error: briefErr },
    { data: amendmentRows, error: amErr },
    { data: studentRow, error: stuErr },
  ] = await Promise.all([
    db
      .from("unit_briefs")
      .select(BRIEF_COLUMNS)
      .eq("unit_id", unitId)
      .maybeSingle(),
    db
      .from("unit_brief_amendments")
      .select(AMENDMENT_COLUMNS)
      .eq("unit_id", unitId)
      .order("created_at", { ascending: true }),
    db
      .from("student_briefs")
      .select(STUDENT_BRIEF_COLUMNS)
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle(),
  ]);

  if (briefErr) {
    return NextResponse.json({ error: briefErr.message }, { status: 500 });
  }
  if (amErr) {
    return NextResponse.json({ error: amErr.message }, { status: 500 });
  }
  if (stuErr) {
    return NextResponse.json({ error: stuErr.message }, { status: 500 });
  }

  // ─── 2. Resolve choice card pick + fetch its brief template ────────
  // Independent of brief existence — students who picked a card with a
  // brief template see it even when there's no class-shared unit_brief.
  let cardTemplate: CardTemplate | null = null;
  const pick = await resolveChoiceCardPickForUnit(db, studentId, unitId);
  if (pick && pick.cardId !== "_pitch-your-own") {
    const { data: cardRow } = await db
      .from("choice_cards")
      .select(CARD_BRIEF_COLUMNS)
      .eq("id", pick.cardId)
      .maybeSingle();
    if (cardRow) {
      const hasTemplate =
        (cardRow.brief_text != null && (cardRow.brief_text as string).length > 0) ||
        (cardRow.brief_constraints &&
          typeof cardRow.brief_constraints === "object" &&
          Object.keys(cardRow.brief_constraints as Record<string, unknown>).length > 0) ||
        (cardRow.brief_locks &&
          typeof cardRow.brief_locks === "object" &&
          Object.keys(cardRow.brief_locks as Record<string, unknown>).length > 0);
      if (hasTemplate) {
        cardTemplate = {
          cardId: pick.cardId,
          cardLabel: pick.label,
          brief_text: (cardRow.brief_text as string | null) ?? null,
          brief_constraints: coerceConstraints(cardRow.brief_constraints),
          brief_locks: coerceLocks(cardRow.brief_locks),
        };
      }
    }
  }

  return NextResponse.json({
    brief: briefRow ? rowToBrief(briefRow) : null,
    amendments: (amendmentRows ?? []).map((row) =>
      rowToAmendment(row as Record<string, unknown>),
    ),
    cardTemplate,
    studentBrief: studentRow ? rowToStudentBrief(studentRow) : null,
  });
}

/**
 * POST /api/student/unit-brief
 *
 * Body: { unitId: string, brief_text?: string | null, constraints?: UnitBriefConstraints }
 *
 * Upserts the student's per-unit override row in student_briefs.
 * Partial-patch — server merges with the existing row (if any), so
 * the client can save just brief_text or just one constraints field
 * at a time. Enrollment-gated.
 *
 * The locks themselves are NOT writable by the student — those live
 * on unit_briefs / choice_cards and are teacher-controlled. The
 * student-side editor only renders editable inputs for fields that
 * are unlocked per the effective merge.
 */
export async function POST(request: NextRequest) {
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

  const db = createAdminClient();
  const denied = await verifyEnrollment(db, studentId, unitId);
  if (denied) return denied;

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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "body must include at least one of: brief_text, constraints" },
      { status: 400 },
    );
  }

  // Fetch existing row so we can do a server-side merge (same pattern
  // as the teacher POST handler — Phase B.1).
  const { data: existing } = await db
    .from("student_briefs")
    .select(STUDENT_BRIEF_COLUMNS)
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .maybeSingle();

  const merged: Record<string, unknown> = existing
    ? { ...existing, ...patch }
    : {
        student_id: studentId,
        unit_id: unitId,
        brief_text: null,
        constraints: { archetype: "design", data: {} },
        diagram_url: null,
        ...patch,
      };

  const { data, error } = await db
    .from("student_briefs")
    .upsert(merged, { onConflict: "student_id,unit_id" })
    .select(STUDENT_BRIEF_COLUMNS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save student brief override" },
      { status: 500 },
    );
  }

  return NextResponse.json({ studentBrief: rowToStudentBrief(data) });
}
