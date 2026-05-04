/**
 * Multi-campus parent-precedence helper.
 *
 * Phase 4.0 scaffold per docs/projects/access-model-v2-phase-4-brief.md
 * §3.9 item 13. NIS has primary + secondary campuses; Sydney Grammar has
 * 3; the schema's `schools.parent_school_id` column has been reserved
 * for this since Phase 0. Phase 4 turns the read precedence on (no UI
 * v1; the super-admin view at §4.7 surfaces a campus tree).
 *
 * Read precedence: when a child school has NULL on an inheritable
 * column, fall back through parent → grandparent → … (max depth 3).
 *
 * Inheritable columns (settings that make sense to share across
 * campuses of one institution):
 *   academic_calendar_jsonb
 *   timetable_skeleton_jsonb
 *   frameworks_in_use_jsonb
 *   default_grading_scale
 *   notification_branding_jsonb
 *   safeguarding_contacts_jsonb
 *   default_student_ai_budget
 *
 * NEVER inherit (each campus owns these):
 *   name, logo, region, country, timezone, default_locale,
 *   status, subscription_tier, allowed_auth_modes
 *
 * Cycle detection: max 3 hops then bail. A cycle is a data integrity
 * bug; raise so it surfaces in alerting rather than silently looping.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PRECEDENCE_DEPTH = 3;

export const INHERITABLE_COLUMNS = [
  "academic_calendar_jsonb",
  "timetable_skeleton_jsonb",
  "frameworks_in_use_jsonb",
  "default_grading_scale",
  "notification_branding_jsonb",
  "safeguarding_contacts_jsonb",
  "default_student_ai_budget",
] as const;

export type InheritableColumn = (typeof INHERITABLE_COLUMNS)[number];

const NEVER_INHERIT: ReadonlySet<string> = new Set([
  "name",
  "logo",
  "region",
  "country",
  "timezone",
  "default_locale",
  "status",
  "subscription_tier",
  "allowed_auth_modes",
]);

export type ResolvedSchoolValue<T = unknown> = {
  /** Resolved value (own value, or inherited, or null if both missing). */
  value: T | null;
  /** Where the value came from. */
  source: "own" | "inherited";
  /** schoolId whose row supplied the value (== input schoolId for source='own'). */
  fromSchoolId: string | null;
  /** Depth from the original child (0 = own, 1 = parent, 2 = grandparent). */
  depth: number;
};

/**
 * Resolve a single column with parent-precedence semantics.
 * Returns { value: null, source: 'own', depth: 0 } if the column is
 * non-inheritable but missing — caller must still handle null.
 */
export async function resolveSchoolColumn<T = unknown>(
  schoolId: string,
  column: InheritableColumn,
  supabase?: SupabaseClient
): Promise<ResolvedSchoolValue<T>> {
  if (NEVER_INHERIT.has(column)) {
    throw new Error(
      `[parent-precedence] Column "${column}" never inherits — use a direct read.`
    );
  }

  const db = supabase ?? createAdminClient();

  let currentId: string | null = schoolId;
  let depth = 0;
  const visited = new Set<string>();

  while (currentId && depth < MAX_PRECEDENCE_DEPTH) {
    if (visited.has(currentId)) {
      throw new Error(
        `[parent-precedence] Cycle detected in parent_school_id chain at ${currentId}`
      );
    }
    visited.add(currentId);

    const { data, error } = await db
      .from("schools")
      .select(`${column}, parent_school_id`)
      .eq("id", currentId)
      .maybeSingle();

    if (error || !data) {
      // Missing school in chain — abort gracefully; surface the failure
      // via null value rather than throwing.
      return {
        value: null,
        source: depth === 0 ? "own" : "inherited",
        fromSchoolId: null,
        depth,
      };
    }

    const record = data as Record<string, unknown>;
    const value = record[column];

    if (value !== null && value !== undefined) {
      return {
        value: value as T,
        source: depth === 0 ? "own" : "inherited",
        fromSchoolId: currentId,
        depth,
      };
    }

    currentId = (record.parent_school_id as string | null) ?? null;
    depth++;
  }

  return { value: null, source: "own", fromSchoolId: null, depth };
}

/**
 * Resolve all inheritable columns at once. Single round-trip per
 * level (one query per ancestor up to MAX_PRECEDENCE_DEPTH).
 * Returns the campus's effective settings as if every NULL had been
 * filled by the nearest ancestor.
 */
export async function resolveSchoolSettings(
  schoolId: string,
  supabase?: SupabaseClient
): Promise<Record<InheritableColumn, ResolvedSchoolValue>> {
  const db = supabase ?? createAdminClient();
  const result = {} as Record<InheritableColumn, ResolvedSchoolValue>;

  let currentId: string | null = schoolId;
  let depth = 0;
  const visited = new Set<string>();
  // Track which columns are still unresolved.
  const pending = new Set<string>(INHERITABLE_COLUMNS);

  while (currentId && depth < MAX_PRECEDENCE_DEPTH && pending.size > 0) {
    if (visited.has(currentId)) {
      throw new Error(
        `[parent-precedence] Cycle detected in parent_school_id chain at ${currentId}`
      );
    }
    visited.add(currentId);

    const selectCols = [...pending, "parent_school_id"].join(", ");
    const { data, error } = await db
      .from("schools")
      .select(selectCols)
      .eq("id", currentId)
      .maybeSingle();

    if (error || !data) break;
    // Dynamic .select(selectCols) widens the data type to the
    // GenericStringError | row union; cast through unknown is the
    // documented way to assert the row shape we know we asked for.
    const record = data as unknown as Record<string, unknown>;

    for (const col of [...pending]) {
      const v = record[col];
      if (v !== null && v !== undefined) {
        result[col as InheritableColumn] = {
          value: v,
          source: depth === 0 ? "own" : "inherited",
          fromSchoolId: currentId,
          depth,
        };
        pending.delete(col);
      }
    }

    currentId = (record.parent_school_id as string | null) ?? null;
    depth++;
  }

  // Anything still pending after walking the chain is null at every level.
  for (const col of pending) {
    result[col as InheritableColumn] = {
      value: null,
      source: "own",
      fromSchoolId: null,
      depth: 0,
    };
  }

  return result;
}
