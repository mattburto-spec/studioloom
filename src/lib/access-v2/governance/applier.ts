/**
 * Maps `change_type` strings to actual column updates on the `schools`
 * table (or related side tables for domain/responsibility/etc additions).
 *
 * Phase 4.4b per docs/projects/access-model-v2-phase-4-brief.md.
 *
 * The Phase 4.3 governance helper (`proposeSchoolSettingChange`) writes
 * the change to the audit ledger but does NOT touch the actual settings
 * column. That separation lets us:
 *
 *   - Persist the audit trail even when the change is high-stakes pending
 *     (column doesn't change yet — only on confirm)
 *   - Cleanly handle revert (read the historical `before_at_propose` from
 *     the payload, write that value back via the same applier)
 *   - Test apply logic without touching the governance helper
 *
 * `applyChange()` is called from:
 *   1. PATCH /api/school/[id]/settings — when proposeSchoolSettingChange
 *      returns status='applied' (low-stakes immediate apply)
 *   2. POST /api/school/[id]/proposals/[changeId]/confirm — Phase 4.4c
 *      (when a 2nd teacher confirms a high-stakes proposal)
 *   3. POST /api/school/[id]/changes/[changeId]/revert — Phase 4.4c
 *      (when reverting; passes `before_at_propose` as the new value)
 *
 * Each change_type registers an "applier" that knows how to write the
 * value to the right column. Unknown change_types throw — explicit
 * registry > silent no-op.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApplyChangeArgs = {
  schoolId: string;
  changeType: string;
  newValue: unknown;
  /** Optional: scope from PayloadV1 — used by domain/responsibility appliers */
  scope?: Record<string, unknown>;
  supabase?: SupabaseClient;
};

export type ApplyChangeResult =
  | { ok: true; changeType: string; rowsAffected: number }
  | { ok: false; changeType: string; reason: string; message: string };

// ─────────────────────────────────────────────────────────────────────
// Per-change-type apply functions
// ─────────────────────────────────────────────────────────────────────
//
// Convention: each applier returns ApplyChangeResult. Keep them small +
// explicit so the registry below is readable at a glance.

type Applier = (
  args: ApplyChangeArgs,
  db: SupabaseClient
) => Promise<ApplyChangeResult>;

const applySchoolColumn = (column: string): Applier => {
  return async ({ schoolId, changeType, newValue }, db) => {
    const { error, count } = await db
      .from("schools")
      .update({ [column]: newValue }, { count: "exact" })
      .eq("id", schoolId);
    if (error) {
      return {
        ok: false,
        changeType,
        reason: "db_error",
        message: error.message,
      };
    }
    return { ok: true, changeType, rowsAffected: count ?? 0 };
  };
};

// `add_school_domain` — Phase 4.4b extends the existing §4.2 POST path so
// that high-stakes-confirmed adds also flow through here. For low-stakes
// auto-verify (matching email domain), §4.2 POST already does the insert
// directly; this applier handles the post-confirm path in §4.4c.
const applyAddSchoolDomain: Applier = async (args, db) => {
  const { schoolId, changeType, newValue } = args;
  const after = newValue as
    | { domain?: string; verified?: boolean; added_by?: string }
    | null;
  if (!after?.domain) {
    return {
      ok: false,
      changeType,
      reason: "invalid_payload",
      message: "newValue must include { domain }",
    };
  }

  const { error } = await db
    .from("school_domains")
    .insert({
      school_id: schoolId,
      domain: after.domain.toLowerCase(),
      verified: after.verified !== false, // default true on confirm path
      added_by: after.added_by ?? null,
    });
  if (error) {
    return {
      ok: false,
      changeType,
      reason: "db_error",
      message: error.message,
    };
  }
  return { ok: true, changeType, rowsAffected: 1 };
};

// `remove_school_domain` — Phase 4.3 already wired the DELETE route to do
// this directly when bootstrap-grace downgraded effectiveTier to low_stakes.
// This applier handles the post-confirm path (high-stakes 2-teacher confirm
// in §4.4c).
const applyRemoveSchoolDomain: Applier = async (args, db) => {
  const { changeType, scope } = args;
  const domainId = scope?.domain_id as string | undefined;
  if (!domainId) {
    return {
      ok: false,
      changeType,
      reason: "invalid_scope",
      message: "scope.domain_id required for remove_school_domain",
    };
  }
  const { error, count } = await db
    .from("school_domains")
    .delete({ count: "exact" })
    .eq("id", domainId);
  if (error) {
    return {
      ok: false,
      changeType,
      reason: "db_error",
      message: error.message,
    };
  }
  return { ok: true, changeType, rowsAffected: count ?? 0 };
};

// ─────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────

const APPLIERS: Record<string, Applier> = {
  // Identity (high-stakes per tier-resolvers.ts)
  school_name: applySchoolColumn("name"),
  school_logo: applySchoolColumn("logo_url"),
  school_region: applySchoolColumn("region"),
  school_country: applySchoolColumn("country"),
  school_timezone: applySchoolColumn("timezone"),
  school_city: applySchoolColumn("city"),
  default_locale: applySchoolColumn("default_locale"),

  // Auth policy (high-stakes)
  auth_policy: applySchoolColumn("allowed_auth_modes"),
  allowed_auth_modes: applySchoolColumn("allowed_auth_modes"),

  // Cost / monetisation (high-stakes for tier; low-stakes for ≤50% AI budget delta)
  subscription_tier: applySchoolColumn("subscription_tier"),
  default_student_ai_budget: applySchoolColumn("default_student_ai_budget"),

  // Calendar / timetable / frameworks (low-stakes; columns added in Phase 4.8)
  academic_calendar: applySchoolColumn("academic_calendar_jsonb"),
  term_dates: applySchoolColumn("academic_calendar_jsonb"),
  holidays: applySchoolColumn("academic_calendar_jsonb"),
  period_bells: applySchoolColumn("timetable_skeleton_jsonb"),
  period_names: applySchoolColumn("timetable_skeleton_jsonb"),
  timetable_skeleton: applySchoolColumn("timetable_skeleton_jsonb"),
  frameworks_in_use: applySchoolColumn("frameworks_in_use_jsonb"),
  default_grading_scale: applySchoolColumn("default_grading_scale"),

  // Branding + content sharing (low-stakes)
  notification_branding: applySchoolColumn("notification_branding_jsonb"),
  notification_footer: applySchoolColumn("notification_branding_jsonb"),
  content_sharing_default: applySchoolColumn("content_sharing_default"),

  // Safeguarding (high-stakes always)
  safeguarding_contacts: applySchoolColumn("safeguarding_contacts_jsonb"),

  // Domain operations (special — write to school_domains, not schools)
  add_school_domain: applyAddSchoolDomain,
  remove_school_domain: applyRemoveSchoolDomain,

  // Status lifecycle (high-stakes; Phase 4.5 merge approval / archive flows)
  // Lower priority but registered for future use.
};

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export async function applyChange(
  args: ApplyChangeArgs
): Promise<ApplyChangeResult> {
  const applier = APPLIERS[args.changeType];
  if (!applier) {
    return {
      ok: false,
      changeType: args.changeType,
      reason: "unknown_change_type",
      message: `No applier registered for change_type '${args.changeType}'. Add an entry to APPLIERS in governance/applier.ts.`,
    };
  }
  const db = args.supabase ?? createAdminClient();
  return await applier(args, db);
}

/** Test-only export to inspect registered change_types. */
export const __TEST__ = {
  APPLIERS,
  KNOWN_CHANGE_TYPES: Object.keys(APPLIERS),
};
