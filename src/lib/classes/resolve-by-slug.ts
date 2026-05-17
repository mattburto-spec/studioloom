import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSlugWithId, buildSlugWithId } from "@/lib/url/slug";

// ---------------------------------------------------------------------------
// Server-side slug resolver for class-canonical canvas URLs.
// (DT canvas Package B.2, 17 May 2026)
// ---------------------------------------------------------------------------
//
// Takes a slug-with-id URL segment (or a legacy raw UUID) and returns
// the class row + active unit_id + the canonical slug. The route
// caller uses the result to:
//   - 404 when the prefix doesn't match any row (returns ok: false, reason: "not_found")
//   - 404 + log when >1 rows share the prefix (returns ok: false, reason: "collision")
//   - render the canvas + (if `canonicalSlug !== passedSegment`)
//     server-redirect to the canonical slug so URL bar stays clean
//     after a class rename
//
// Discriminated-union return mirrors src/lib/classes/active-unit.ts +
// src/lib/ai/call.ts conventions.
//
// The query uses RLS-respecting client (callers pass a server-side
// Supabase client with the teacher's session), so no extra
// ownership check is needed — the classes table's RLS policy
// (Phase 1.4 CS-2 + the teacher-of-class chain) already scopes
// the row set to ones the caller can access.
// ---------------------------------------------------------------------------

export interface ResolvedClass {
  classId: string;
  name: string | null;
  activeUnitId: string | null;
  /** The slug that matches the current class.name. May differ from the
   *  segment the caller passed (when the class was renamed). The caller
   *  should server-redirect to this when it doesn't match the passed
   *  segment to keep the URL bar in sync. */
  canonicalSlug: string;
}

export type ResolveResult =
  | { ok: true; data: ResolvedClass }
  | { ok: false; reason: "not_found" | "collision" | "query_error"; error?: string };

/**
 * Resolve a /teacher/c/<segment> URL to a class + active unit.
 *
 *   segment="9-design-science-s2-b97888"  →  prefix lookup by "b97888"
 *   segment="b97888a4-c22e-49fb-..."      →  exact UUID lookup (legacy)
 *
 * Fetches all classes the caller can see (RLS-scoped) then filters
 * by prefix client-side. At pilot scale a teacher has ~10s of
 * classes; even at platform-wide scale RLS narrows the candidates
 * to ones the teacher actually has access to, which won't blow up.
 */
export async function resolveClassBySlug(
  supabase: SupabaseClient,
  segment: string,
): Promise<ResolveResult> {
  const { idPrefix, isRawUuid } = parseSlugWithId(segment);

  // 1. Fetch the candidate class(es). For raw UUIDs we can do an
  //    exact `.eq("id", uuid)`; for prefixes we fetch the teacher's
  //    classes + filter.
  let candidates: Array<{ id: string; name: string | null }> = [];
  if (isRawUuid) {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name")
      .eq("id", idPrefix)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      return { ok: false, reason: "query_error", error: error.message };
    }
    if (data) candidates = [data];
  } else {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name")
      .order("created_at", { ascending: false });
    if (error) {
      return { ok: false, reason: "query_error", error: error.message };
    }
    candidates = (data || []).filter((c) => c.id.toLowerCase().startsWith(idPrefix.toLowerCase()));
  }

  if (candidates.length === 0) {
    return { ok: false, reason: "not_found" };
  }
  if (candidates.length > 1) {
    // Same-prefix collision. Statistically vanishingly rare at the
    // current pilot scale (6 hex chars × tiny per-teacher class count)
    // but defensive — caller 404s with a hint to use the full UUID.
    return { ok: false, reason: "collision" };
  }

  const cls = candidates[0];

  // 2. Look up the active unit for this class. Partial unique index
  //    (migration 20260515214045) guarantees at-most-one active row,
  //    so .maybeSingle() is safe.
  const { data: activeRow, error: auErr } = await supabase
    .from("class_units")
    .select("unit_id")
    .eq("class_id", cls.id)
    .eq("is_active", true)
    .maybeSingle();
  if (auErr && auErr.code !== "PGRST116") {
    return { ok: false, reason: "query_error", error: auErr.message };
  }

  return {
    ok: true,
    data: {
      classId: cls.id,
      name: cls.name,
      activeUnitId: activeRow?.unit_id ?? null,
      canonicalSlug: buildSlugWithId(cls.name, cls.id),
    },
  };
}
