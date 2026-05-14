/**
 * Shared validators + coercers for unit_briefs / choice_cards brief
 * templates / student_briefs.
 *
 * Extracted from `src/app/api/teacher/unit-brief/route.ts` in Phase F.C
 * because the same validation logic is now needed by:
 *   - /api/teacher/unit-brief (POST upsert)
 *   - /api/teacher/choice-cards (POST + PATCH; brief_text / brief_constraints / brief_locks)
 *   - /api/student/unit-brief (Phase F.D POST when student overrides land)
 *
 * Lesson #38 specificity: every validator rejects unknown keys + wrong
 * shapes loudly. Coercers are the read-side defensive counterpart —
 * stale data in the DB JSONB is silently narrowed rather than thrown.
 */

import type {
  UnitBriefConstraints,
  UnitBriefLocks,
} from "@/types/unit-brief";
import { LOCKABLE_FIELDS } from "@/types/unit-brief";

export const GENERIC_CONSTRAINTS: UnitBriefConstraints = {
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
 * `{}` (empty object); map that to the generic fallback so the client
 * never has to handle an "empty shape" case.
 */
export function coerceConstraints(raw: unknown): UnitBriefConstraints {
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
export function validateConstraints(
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
export function validateLocks(
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
export function coerceLocks(raw: unknown): UnitBriefLocks {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: UnitBriefLocks = {};
  for (const field of LOCKABLE_FIELDS) {
    if (r[field] === true) out[field] = true;
  }
  return out;
}
