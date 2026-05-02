/**
 * Governance engine type contracts.
 *
 * Phase 4.0 scaffold per docs/projects/access-model-v2-phase-4-brief.md
 * §3.9 item 14 (version-stamping shape) + §3.8 Q2 (context-aware tier).
 *
 * These types are stable enough for §4.3's `proposeSchoolSettingChange`
 * helper to land against. Don't extend this file in a Phase 4.0 commit
 * beyond what the brief specifies — extension belongs in §4.3 with the
 * helper that consumes the new variants.
 */

/**
 * Tier classification result. NOT a static enum value carried with each
 * row — it's resolved dynamically per change_type from
 * `governance/tier-resolvers.ts` (§3.8 Q2).
 *
 * Persisted in `school_setting_changes.tier` for audit traceability,
 * but the source of truth for "what should this change's tier be?" is
 * the resolver function, not the persisted value.
 */
export type SchoolSettingChangeTier = "low_stakes" | "high_stakes";

/**
 * Lifecycle status. Mirrors the Postgres enum
 * `school_setting_change_status` defined in §4.3's migration.
 *
 *   pending  — high-stakes proposal awaiting 2nd-teacher confirm
 *   applied  — low-stakes (instant) OR confirmed high-stakes
 *   reverted — reverted within 7-day window (low-stakes only)
 *   expired  — high-stakes 48h window passed without confirm
 */
export type SchoolSettingChangeStatus =
  | "pending"
  | "applied"
  | "reverted"
  | "expired";

/**
 * Version-stamped payload for school_setting_changes.payload_jsonb.
 *
 * §3.9 item 14: at proposal-create time, snapshot the current value
 * into `before_at_propose`. At confirm time, the UI computes
 * `current value` live + shows a 3-way diff:
 *
 *   before_at_propose → current (right now) → after (if confirmed)
 *
 * If `current ≠ before_at_propose`, the UI flags the proposal as
 * stale ("⚠ Value changed since proposed") so confirmer-Bob can see
 * if anything moved during the 48h window.
 */
export type SchoolSettingChangePayloadV1<T = unknown> = {
  /** Schema version — bumped if the shape ever changes. v1 from Phase 4. */
  version: 1;
  /** Snapshot of the persisted value at proposal-create time. */
  before_at_propose: T;
  /** Proposed new value. */
  after: T;
  /**
   * Setting-specific extra context (e.g. for `add_school_domain`,
   * scope might carry { domain, requester_email_match: bool }).
   * Resolvers can read this to make tier decisions.
   */
  scope?: Record<string, unknown>;
};

/**
 * Context passed to a tier resolver. Carries everything the resolver
 * may consult: the proposed payload, the actor identity (for self-
 * verification paths like add_school_domain), and the school being
 * changed (for tier-default lookups in cascade resolvers).
 */
export type TierResolverContext<T = unknown> = {
  changeType: string;
  payload: SchoolSettingChangePayloadV1<T>;
  actor: {
    userId: string;
    email: string;
    isPlatformAdmin: boolean;
  };
  schoolId: string;
};

/**
 * Tier resolver function signature. Synchronous when possible (cheap
 * payload inspection); async when a DB lookup is required (e.g.,
 * "is this AI-budget delta >50% of current value?").
 */
export type TierResolver = (
  ctx: TierResolverContext
) => SchoolSettingChangeTier | Promise<SchoolSettingChangeTier>;

/**
 * Rate-limit window state, mirrors the
 * `school_setting_changes_rate_state` table (§4.3 migration).
 *
 *   actor_user_id — who is rate-limited
 *   window_start  — bucket boundary (truncated to the hour)
 *   count         — how many changes proposed in this bucket
 *
 * Sliding-hour semantics: the limit (10/hr/teacher) is enforced as
 * `SUM(count) WHERE window_start ≥ now() - 1h <= 10`, NOT as a single
 * fixed window. Buckets are hourly so we don't need a row-per-event;
 * counter aggregation keeps the table small.
 */
export type RateLimitState = {
  actor_user_id: string;
  window_start: string; // ISO timestamp
  count: number;
};
