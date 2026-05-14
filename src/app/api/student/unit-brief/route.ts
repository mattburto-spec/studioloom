// Unit Briefs Foundation Phase C.1 — student-side read endpoint.
//
// GET /api/student/unit-brief?unitId=<uuid>
//   → { brief: UnitBrief | null, amendments: UnitBriefAmendment[] }
//
// Auth: token-session via requireStudentSession (Lesson #4 — students
// don't use Supabase Auth). All DB reads go through the service-role
// admin client.
//
// Authorization (enrollment check): student must be in an active class
// that has the unit assigned. Mirrors the canonical pattern from
// /api/student/unit/route.ts:
//   class_students (is_active=true) → class_units (is_active=true) on
//   the requested unit. Includes the legacy students.class_id fallback
//   so pre-junction-table enrolments still resolve.
//
// Returns null brief when the unit has no unit_briefs row yet (the
// teacher hasn't authored anything). Amendments are returned ordered
// oldest-first — the drawer reads them top-to-bottom as the brief's
// evolution story (per Phase C spec).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import type {
  UnitBrief,
  UnitBriefAmendment,
  UnitBriefConstraints,
  UnitBriefLocks,
} from "@/types/unit-brief";
import { LOCKABLE_FIELDS } from "@/types/unit-brief";

const BRIEF_COLUMNS =
  "unit_id, brief_text, constraints, diagram_url, locks, created_at, updated_at, created_by";
const AMENDMENT_COLUMNS =
  "id, unit_id, version_label, title, body, created_at, created_by";

const GENERIC_CONSTRAINTS: UnitBriefConstraints = {
  archetype: "generic",
  data: {},
};

function coerceConstraints(raw: unknown): UnitBriefConstraints {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return GENERIC_CONSTRAINTS;
  }
  const r = raw as Record<string, unknown>;
  if (r.archetype === "design" && r.data && typeof r.data === "object") {
    return { archetype: "design", data: r.data as UnitBriefConstraints["data"] };
  }
  return GENERIC_CONSTRAINTS;
}

function coerceLocks(raw: unknown): UnitBriefLocks {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: UnitBriefLocks = {};
  for (const field of LOCKABLE_FIELDS) {
    if (r[field] === true) out[field] = true;
  }
  return out;
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

  // ─── Enrollment check ──────────────────────────────────────────────
  // Pull the student's active class enrollments (junction + legacy
  // students.class_id fallback for pre-junction rows), then verify any
  // of those classes has the unit assigned (active).
  const { data: enrollments } = await db
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true);

  const activeClassIds = new Set<string>(
    (enrollments ?? []).map((e) => e.class_id as string),
  );

  // Legacy fallback — pre-junction-table rows
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

  // ─── Brief + amendments ────────────────────────────────────────────
  const [{ data: briefRow, error: briefErr }, { data: amendmentRows, error: amErr }] =
    await Promise.all([
      db
        .from("unit_briefs")
        .select(BRIEF_COLUMNS)
        .eq("unit_id", unitId)
        .maybeSingle(),
      db
        .from("unit_brief_amendments")
        .select(AMENDMENT_COLUMNS)
        .eq("unit_id", unitId)
        // Oldest-first: drawer renders amendments top-to-bottom in the
        // order the teacher issued them. Phase C spec.
        .order("created_at", { ascending: true }),
    ]);

  if (briefErr) {
    return NextResponse.json({ error: briefErr.message }, { status: 500 });
  }
  if (amErr) {
    return NextResponse.json({ error: amErr.message }, { status: 500 });
  }

  return NextResponse.json({
    brief: briefRow ? rowToBrief(briefRow) : null,
    amendments: (amendmentRows ?? []).map((row) =>
      rowToAmendment(row as Record<string, unknown>),
    ),
  });
}
