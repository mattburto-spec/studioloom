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
import type {
  UnitBrief,
  UnitBriefConstraints,
  UnitBriefLocks,
} from "@/types/unit-brief";
import { LOCKABLE_FIELDS } from "@/types/unit-brief";

const COLUMNS_RETURNED =
  "unit_id, brief_text, constraints, diagram_url, locks, created_at, updated_at, created_by";

const GENERIC_CONSTRAINTS: UnitBriefConstraints = {
  archetype: "generic",
  data: {},
};

const ALLOWED_DESIGN_KEYS = new Set([
  "dimensions",
  "materials_whitelist",
  "budget",
  "audience",
  "must_include",
  "must_avoid",
]);

/**
 * Coerce a stored constraints JSONB value into the discriminated
 * UnitBriefConstraints shape the client expects. DB rows default to
 * `{}` (empty object) per the migration; map that to the generic
 * fallback so the client never has to handle an "empty shape" case.
 */
function coerceConstraints(raw: unknown): UnitBriefConstraints {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return GENERIC_CONSTRAINTS;
  }
  const r = raw as Record<string, unknown>;
  if (r.archetype === "design" && r.data && typeof r.data === "object") {
    return { archetype: "design", data: r.data as UnitBriefConstraints["data"] };
  }
  if (r.archetype === "generic") {
    return GENERIC_CONSTRAINTS;
  }
  return GENERIC_CONSTRAINTS;
}

/**
 * Validate a constraints payload from the client. Returns the
 * normalised value on success or an error message describing what's
 * wrong on failure. Strict shape check — unknown archetype is rejected
 * to prevent silent drift when we add new ones.
 */
function validateConstraints(
  raw: unknown,
): { ok: true; value: UnitBriefConstraints } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "constraints must be an object" };
  }
  const r = raw as Record<string, unknown>;
  if (r.archetype === "generic") {
    return { ok: true, value: GENERIC_CONSTRAINTS };
  }
  if (r.archetype === "design") {
    if (!r.data || typeof r.data !== "object" || Array.isArray(r.data)) {
      return { ok: false, error: "constraints.data must be an object" };
    }
    const data = r.data as Record<string, unknown>;
    // Validate each known field shape; reject unknown keys to fail loudly
    // when a client posts a typo (Lesson #38 family: be specific, not lax).
    for (const key of Object.keys(data)) {
      if (!ALLOWED_DESIGN_KEYS.has(key)) {
        return { ok: false, error: `Unknown constraints.data key: ${key}` };
      }
    }
    for (const stringKey of ["budget", "audience"] as const) {
      if (stringKey in data && data[stringKey] !== undefined) {
        if (typeof data[stringKey] !== "string") {
          return { ok: false, error: `constraints.data.${stringKey} must be a string` };
        }
      }
    }
    // dimensions is a structured H×W×D object after Phase B smoke polish
    // (was free-text before — Matt's smoke feedback asked for HxWxD manual
    // edit). All three axes optional, unit ∈ {mm, cm, in}, h/w/d numeric.
    if ("dimensions" in data && data.dimensions !== undefined) {
      const dim = data.dimensions;
      if (!dim || typeof dim !== "object" || Array.isArray(dim)) {
        return {
          ok: false,
          error: "constraints.data.dimensions must be an object",
        };
      }
      const d = dim as Record<string, unknown>;
      const allowedDimKeys = new Set(["h", "w", "d", "unit"]);
      for (const key of Object.keys(d)) {
        if (!allowedDimKeys.has(key)) {
          return {
            ok: false,
            error: `Unknown constraints.data.dimensions key: ${key}`,
          };
        }
      }
      for (const axis of ["h", "w", "d"] as const) {
        if (axis in d && d[axis] !== undefined && d[axis] !== null) {
          const v = d[axis];
          if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
            return {
              ok: false,
              error: `constraints.data.dimensions.${axis} must be a non-negative number`,
            };
          }
        }
      }
      if ("unit" in d && d.unit !== undefined && d.unit !== null) {
        if (d.unit !== "mm" && d.unit !== "cm" && d.unit !== "in") {
          return {
            ok: false,
            error: "constraints.data.dimensions.unit must be 'mm' | 'cm' | 'in'",
          };
        }
      }
    }
    for (const arrayKey of [
      "materials_whitelist",
      "must_include",
      "must_avoid",
    ] as const) {
      if (arrayKey in data && data[arrayKey] !== undefined) {
        if (!Array.isArray(data[arrayKey])) {
          return {
            ok: false,
            error: `constraints.data.${arrayKey} must be an array of strings`,
          };
        }
        if (!(data[arrayKey] as unknown[]).every((v) => typeof v === "string")) {
          return {
            ok: false,
            error: `constraints.data.${arrayKey} must be an array of strings`,
          };
        }
      }
    }
    return {
      ok: true,
      value: { archetype: "design", data: data as UnitBriefConstraints["data"] },
    };
  }
  return { ok: false, error: "constraints.archetype must be 'design' or 'generic'" };
}

/**
 * Validate a `locks` payload from the teacher editor. Accepts a flat
 * map where every key is in LOCKABLE_FIELDS and every value is a
 * strict boolean. Unknown keys are rejected (Lesson #38 specificity —
 * fail loud on typos). Returns the canonicalised map (false / absent
 * keys collapsed to absent; only `true` stored).
 */
function validateLocks(
  raw: unknown,
): { ok: true; value: UnitBriefLocks } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "locks must be an object" };
  }
  const r = raw as Record<string, unknown>;
  const out: UnitBriefLocks = {};
  const allowed = new Set<string>(LOCKABLE_FIELDS);
  for (const key of Object.keys(r)) {
    if (!allowed.has(key)) {
      return { ok: false, error: `Unknown locks key: ${key}` };
    }
    if (typeof r[key] !== "boolean") {
      return { ok: false, error: `locks.${key} must be a boolean` };
    }
    if (r[key] === true) {
      // Canonical: only store `true`. False / absent both mean unlocked.
      out[key as (typeof LOCKABLE_FIELDS)[number]] = true;
    }
  }
  return { ok: true, value: out };
}

/**
 * Coerce a stored locks JSONB into the typed UnitBriefLocks shape.
 * Defensive against drift: keys not in LOCKABLE_FIELDS are silently
 * dropped so a future column rename can't ship stale lock keys to the
 * editor or drawer. Values are narrowed to strict booleans.
 */
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
