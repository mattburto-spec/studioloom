/**
 * Context-aware tier classification for school setting changes.
 *
 * Phase 4.3 per docs/projects/access-model-v2-phase-4-brief.md §3.8 Q2.
 *
 * Tier resolution is NOT a static enum lookup — it inspects payload +
 * actor + change_type to compute tier dynamically. Examples:
 *
 *   add_school_domain          → low if requester email matches the
 *                                domain being added; else high
 *   default_student_ai_budget  → low if delta ≤50% of current value;
 *                                else high (cost blast radius)
 *   safeguarding_contacts      → ALWAYS high (security boundary)
 *   period_bells / framework   → low (operational metadata)
 *   school_name / region       → high (identity blast radius)
 *
 * Each resolver is a pure(-ish) function over `TierResolverContext`
 * (governance/types.ts). Side-effect-free where possible; helpers may
 * read DB for current-value lookups.
 *
 * Default fallback: `low_stakes` for unknown change_types. New
 * change_types must register a resolver here; if missing, the change
 * lands as low_stakes (CI lint + grep can flag missing entries).
 */

import type {
  SchoolSettingChangeTier,
  TierResolver,
  TierResolverContext,
} from "./types";

// ─────────────────────────────────────────────────────────────────────
// Per-change-type resolvers
// ─────────────────────────────────────────────────────────────────────

/**
 * Adding a `school_domains` row:
 *   - LOW when the requester's email domain matches the domain being added
 *     (auto-verify path; aligns with welcome-wizard intent — same teacher
 *     who owns the email proves the school owns it)
 *   - HIGH otherwise (claiming someone else's domain requires 2-confirm)
 *
 * Free-email domains are blocked at the route layer + DB layer regardless
 * of tier — they never reach the resolver.
 */
const resolveAddSchoolDomain: TierResolver = (ctx) => {
  const after = (ctx.payload.after as { domain?: unknown } | null) ?? null;
  const domain =
    typeof after?.domain === "string" ? after.domain.toLowerCase() : null;
  const requesterDomain = ctx.actor.email.split("@")[1]?.toLowerCase() ?? "";

  if (domain && requesterDomain && domain === requesterDomain) {
    return "low_stakes";
  }
  return "high_stakes";
};

/**
 * Removing a `school_domains` row: ALWAYS high-stakes. Removing a
 * verified domain locks teachers out of the auto-suggest path and can
 * orphan future signups from that school.
 */
const resolveRemoveSchoolDomain: TierResolver = () => "high_stakes";

/**
 * Default-AI-budget changes:
 *   - LOW when |delta| / before ≤ 0.5 (operational tweak)
 *   - HIGH when |delta| / before > 0.5 (cost blast radius)
 *
 * Edge case: if `before` is 0 or null (no prior budget), any value
 * is high-stakes — first-time settings are baseline-defining.
 */
const resolveAiBudget: TierResolver = (ctx) => {
  const before = Number(ctx.payload.before_at_propose ?? 0);
  const after = Number(ctx.payload.after ?? 0);

  if (!before || before === 0) return "high_stakes";

  const delta = Math.abs(after - before);
  const ratio = delta / before;

  return ratio > 0.5 ? "high_stakes" : "low_stakes";
};

/**
 * ALWAYS high-stakes changes (security / identity / cost boundaries).
 */
const ALWAYS_HIGH_STAKES = new Set([
  // Identity
  "school_name",
  "school_logo",
  "school_region",
  "school_country",
  "school_timezone",

  // Auth policy (locking out teachers)
  "auth_policy",
  "allowed_auth_modes",
  "required_sso_domain",

  // Membership (removing a teacher = removing access)
  "remove_teacher",

  // Security boundary
  "safeguarding_contacts",

  // Cost / monetisation
  "subscription_tier",

  // Data destruction
  "delete_lab_with_jobs",
  "delete_machine_with_jobs",
  "audit_log_truncate",
  "mass_delete_student_data",

  // Governance
  "approve_school_merge",
  "remove_school_domain",
]);

/**
 * ALWAYS low-stakes changes (operational metadata).
 */
const ALWAYS_LOW_STAKES = new Set([
  // Calendar / timetable
  "academic_calendar",
  "term_dates",
  "holidays",
  "period_bells",
  "period_names",
  "timetable_skeleton",

  // Frameworks (multi-select edits)
  "frameworks_in_use",
  "default_grading_scale",

  // Preflight
  "machine_list_add",
  "machine_list_edit",
  "scanner_rule_toggle",
  "ack_default",
  "lab_hours",
  "pickup_sla",
  "fabricator_invite",

  // Branding (cosmetic)
  "notification_footer",
  "notification_branding",

  // Sharing default
  "content_sharing_default",
]);

const RESOLVERS: Record<string, TierResolver> = {
  add_school_domain: resolveAddSchoolDomain,
  remove_school_domain: resolveRemoveSchoolDomain,
  default_student_ai_budget: resolveAiBudget,
};

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the tier for a proposed setting change.
 *
 * Resolution order:
 *   1. Per-change-type resolver (if registered) — highest precedence
 *   2. ALWAYS_HIGH_STAKES set
 *   3. ALWAYS_LOW_STAKES set
 *   4. Fallback: low_stakes (default for unknown change types)
 */
export async function resolveTier(
  ctx: TierResolverContext
): Promise<SchoolSettingChangeTier> {
  const resolver = RESOLVERS[ctx.changeType];
  if (resolver) {
    return await resolver(ctx);
  }

  if (ALWAYS_HIGH_STAKES.has(ctx.changeType)) {
    return "high_stakes";
  }

  if (ALWAYS_LOW_STAKES.has(ctx.changeType)) {
    return "low_stakes";
  }

  // Unknown change_type. Default to low_stakes — but log so we can audit.
  // (CI lint can grep for known change_types vs callsites to flag
  // missing entries; for now the runtime fallback is permissive.)
  console.warn(
    `[tier-resolvers] Unknown change_type '${ctx.changeType}' — defaulting to low_stakes. Add an entry to ALWAYS_HIGH_STAKES / ALWAYS_LOW_STAKES / RESOLVERS in tier-resolvers.ts.`
  );
  return "low_stakes";
}

// ─────────────────────────────────────────────────────────────────────
// Test exports — kept narrow on purpose
// ─────────────────────────────────────────────────────────────────────

export const __TEST__ = {
  ALWAYS_HIGH_STAKES,
  ALWAYS_LOW_STAKES,
  resolveAddSchoolDomain,
  resolveRemoveSchoolDomain,
  resolveAiBudget,
};
