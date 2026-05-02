/**
 * Archived-school guard helper.
 *
 * Phase 4.0 scaffold per docs/projects/access-model-v2-phase-4-brief.md
 * §3.9 item 16. Threaded through every mutation route in 4.4–4.7 so an
 * archived school's data stays read-only rather than 404'd — preserves
 * "what units did NIS make in 2026?" five years later.
 *
 * Returns a tagged result instead of throwing so callers can either:
 *   (a) gate a mutation route — return 403 with reason 'archived_school'
 *   (b) annotate a read response — { data, read_only: true }
 *
 * Behaviour by status:
 *   active        → readOnly: false
 *   dormant       → readOnly: false (writes still allowed; cron may
 *                                    upgrade dormant → active on activity)
 *   archived      → readOnly: true,  reason: 'archived_school'
 *   merged_into   → readOnly: true,  reason: 'merged_school'
 *                   (caller should redirect via resolveSchoolId helper)
 *
 * Missing school (deleted or never-existed) → readOnly: true with
 * reason 'school_not_found'. Callers must still handle the 404 case
 * explicitly; this helper doesn't substitute for not-found checks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type ArchivedGuardStatus =
  | "active"
  | "dormant"
  | "archived"
  | "merged_into";

export type ArchivedGuardReason =
  | "archived_school"
  | "merged_school"
  | "school_not_found";

export type ArchivedGuardResult =
  | { readOnly: false; status: ArchivedGuardStatus }
  | { readOnly: true; status: ArchivedGuardStatus | null; reason: ArchivedGuardReason };

const READ_ONLY_STATUSES: ReadonlySet<ArchivedGuardStatus> = new Set([
  "archived",
  "merged_into",
]);

export async function enforceArchivedReadOnly(
  schoolId: string,
  supabase?: SupabaseClient
): Promise<ArchivedGuardResult> {
  const db = supabase ?? createAdminClient();

  const { data, error } = await db
    .from("schools")
    .select("status")
    .eq("id", schoolId)
    .maybeSingle();

  if (error || !data) {
    return { readOnly: true, status: null, reason: "school_not_found" };
  }

  const status = data.status as ArchivedGuardStatus;

  if (!READ_ONLY_STATUSES.has(status)) {
    return { readOnly: false, status };
  }

  return {
    readOnly: true,
    status,
    reason: status === "merged_into" ? "merged_school" : "archived_school",
  };
}

/**
 * Convenience predicate for callers that only care about the boolean.
 * Prefer `enforceArchivedReadOnly` when you need the reason for a 403
 * response or activity-feed entry.
 */
export async function isSchoolReadOnly(
  schoolId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const result = await enforceArchivedReadOnly(schoolId, supabase);
  return result.readOnly;
}
