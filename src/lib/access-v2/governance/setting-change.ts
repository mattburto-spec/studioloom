/**
 * School-setting governance helpers — the core of Phase 4.3.
 *
 * Three public functions:
 *   proposeSchoolSettingChange()  — entry point for ANY school-setting write
 *   confirmHighStakesChange()     — 2nd-teacher confirms a pending proposal
 *   revertChange()                — same-school teacher reverts within 7 days
 *
 * All three:
 *   - Wrap in school_setting_changes for audit trail
 *   - Check rate limit via enforce_setting_change_rate_limit RPC
 *   - Check archived-school read-only guard
 *   - Honor governance kill-switch via isGovernanceEngineRolloutEnabled()
 *
 * Bootstrap grace exception (§3.8 Q6): when schools.bootstrap_expires_at
 * IS NULL OR > now() (single-teacher mode), proposeSchoolSettingChange
 * treats high-stakes as low-stakes — the lone teacher auto-confirms.
 * Once the window closes (2nd teacher joins → trigger flips
 * bootstrap_expires_at = now()), the 2-tier rule activates permanently.
 *
 * Version stamping (§3.9 item 14): payload always carries
 * before_at_propose snapshot so confirm UI can show 3-way diff
 * (proposed-before → current-now → after).
 *
 * 7-day revert window: enforced in revertChange — applied_at must be
 * within last 7 days. Cron doesn't auto-revert; it just makes the
 * revert button unavailable past the window via the helper's check.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceArchivedReadOnly } from "../school/archived-guard";
import { isGovernanceEngineRolloutEnabled } from "./rollout-flag";
import { resolveTier } from "./tier-resolvers";
import type {
  SchoolSettingChangeTier,
  SchoolSettingChangeStatus,
  SchoolSettingChangePayloadV1,
  TierResolverContext,
} from "./types";

const HIGH_STAKES_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours
const REVERT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────

export type ProposeResult =
  | {
      ok: true;
      changeId: string;
      tier: SchoolSettingChangeTier;
      status: SchoolSettingChangeStatus;
      appliedAt: Date | null;
      expiresAt: Date | null;
      effectiveTier: SchoolSettingChangeTier;
    }
  | {
      ok: false;
      reason:
        | "rate_limited"
        | "archived_school"
        | "merged_school"
        | "school_not_found"
        | "governance_disabled"
        | "db_error";
      retryAfterSeconds?: number;
      message: string;
    };

export type ConfirmResult =
  | {
      ok: true;
      changeId: string;
      appliedAt: Date;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_pending"
        | "self_confirm_forbidden"
        | "expired"
        | "db_error";
      message: string;
    };

export type RevertResult =
  | {
      ok: true;
      changeId: string;
      revertedAt: Date;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_applied"
        | "outside_revert_window"
        | "db_error";
      message: string;
    };

// ─────────────────────────────────────────────────────────────────────
// proposeSchoolSettingChange
// ─────────────────────────────────────────────────────────────────────

export async function proposeSchoolSettingChange(args: {
  schoolId: string;
  actor: TierResolverContext["actor"];
  changeType: string;
  payload: SchoolSettingChangePayloadV1;
  /** Optional: override resolved tier. Used by callers who already know. */
  forcedTier?: SchoolSettingChangeTier;
  supabase?: SupabaseClient;
}): Promise<ProposeResult> {
  const db = args.supabase ?? createAdminClient();

  // 1. Kill-switch
  if (!(await isGovernanceEngineRolloutEnabled(db))) {
    return {
      ok: false,
      reason: "governance_disabled",
      message:
        "Governance engine is currently disabled. Settings changes are paused.",
    };
  }

  // 2. Archived guard
  const guard = await enforceArchivedReadOnly(args.schoolId, db);
  if (guard.readOnly) {
    return {
      ok: false,
      reason: guard.reason,
      message: `School is ${guard.status ?? "missing"} — settings changes blocked.`,
    };
  }

  // 3. Rate limit
  const { data: rateRows, error: rateErr } = await db.rpc(
    "enforce_setting_change_rate_limit",
    { _actor: args.actor.userId, _max_changes: 10, _window_hours: 1 }
  );
  if (rateErr) {
    console.error("[setting-change] rate limit RPC failed:", rateErr.message);
    return {
      ok: false,
      reason: "db_error",
      message: "Rate limit check failed.",
    };
  }
  const rate = Array.isArray(rateRows) ? rateRows[0] : rateRows;
  if (rate?.rate_limited === true) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 3600 - (Date.now() % 3600000) / 1000,
      message: `Rate limit reached (${rate.window_total} changes in last hour). Try again later.`,
    };
  }

  // 4. Resolve tier
  const ctx: TierResolverContext = {
    changeType: args.changeType,
    payload: args.payload,
    actor: args.actor,
    schoolId: args.schoolId,
  };
  const resolvedTier = args.forcedTier ?? (await resolveTier(ctx));

  // 5. Bootstrap grace check — if school is in single-teacher bootstrap
  //    mode, treat high-stakes as low-stakes.
  let effectiveTier: SchoolSettingChangeTier = resolvedTier;
  if (resolvedTier === "high_stakes") {
    const { data: schoolRow } = await db
      .from("schools")
      .select("bootstrap_expires_at")
      .eq("id", args.schoolId)
      .maybeSingle();

    const bootstrap = schoolRow?.bootstrap_expires_at as string | null;
    const bootstrapActive =
      bootstrap === null || new Date(bootstrap).getTime() > Date.now();

    if (bootstrapActive) {
      effectiveTier = "low_stakes";
    }
  }

  // 6. Insert into ledger
  const now = new Date();
  const isLowStakes = effectiveTier === "low_stakes";
  const insertRow = {
    school_id: args.schoolId,
    actor_user_id: args.actor.userId,
    change_type: args.changeType,
    tier: resolvedTier, // Persist the RESOLVED tier; effectiveTier captured in payload.scope
    payload_jsonb: {
      ...args.payload,
      scope: {
        ...(args.payload.scope ?? {}),
        effective_tier: effectiveTier,
        bootstrap_grace_applied: effectiveTier !== resolvedTier,
      },
    },
    status: (isLowStakes ? "applied" : "pending") as SchoolSettingChangeStatus,
    applied_at: isLowStakes ? now.toISOString() : null,
    expires_at: isLowStakes
      ? null
      : new Date(now.getTime() + HIGH_STAKES_EXPIRY_MS).toISOString(),
  };

  const { data: inserted, error } = await db
    .from("school_setting_changes")
    .insert(insertRow)
    .select("id, tier, status, applied_at, expires_at")
    .single();

  if (error || !inserted) {
    console.error(
      "[setting-change] insert failed:",
      error?.message ?? "no data"
    );
    return {
      ok: false,
      reason: "db_error",
      message: "Failed to record setting change.",
    };
  }

  return {
    ok: true,
    changeId: inserted.id,
    tier: inserted.tier as SchoolSettingChangeTier,
    status: inserted.status as SchoolSettingChangeStatus,
    appliedAt: inserted.applied_at ? new Date(inserted.applied_at) : null,
    expiresAt: inserted.expires_at ? new Date(inserted.expires_at) : null,
    effectiveTier,
  };
}

// ─────────────────────────────────────────────────────────────────────
// confirmHighStakesChange
// ─────────────────────────────────────────────────────────────────────

export async function confirmHighStakesChange(args: {
  changeId: string;
  confirmerUserId: string;
  supabase?: SupabaseClient;
}): Promise<ConfirmResult> {
  const db = args.supabase ?? createAdminClient();

  const { data: row, error: readErr } = await db
    .from("school_setting_changes")
    .select(
      "id, school_id, actor_user_id, status, expires_at, tier"
    )
    .eq("id", args.changeId)
    .maybeSingle();

  if (readErr || !row) {
    return {
      ok: false,
      reason: "not_found",
      message: "Setting change not found.",
    };
  }

  if (row.status !== "pending") {
    return {
      ok: false,
      reason: "not_pending",
      message: `Change is ${row.status}, not pending.`,
    };
  }

  // Self-confirm guard: the proposer cannot also confirm.
  if (row.actor_user_id === args.confirmerUserId) {
    return {
      ok: false,
      reason: "self_confirm_forbidden",
      message: "You cannot confirm your own proposal — needs another teacher.",
    };
  }

  // Expiry check (cron may not have run yet)
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      reason: "expired",
      message: "This proposal expired before confirmation.",
    };
  }

  const appliedAt = new Date();
  const { error: updateErr } = await db
    .from("school_setting_changes")
    .update({
      status: "applied",
      applied_at: appliedAt.toISOString(),
      confirmed_by_user_id: args.confirmerUserId,
    })
    .eq("id", args.changeId)
    .eq("status", "pending"); // optimistic concurrency — race-safe

  if (updateErr) {
    console.error("[setting-change] confirm update failed:", updateErr.message);
    return {
      ok: false,
      reason: "db_error",
      message: "Failed to confirm change.",
    };
  }

  return {
    ok: true,
    changeId: args.changeId,
    appliedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────
// revertChange
// ─────────────────────────────────────────────────────────────────────

export async function revertChange(args: {
  changeId: string;
  reverterUserId: string;
  supabase?: SupabaseClient;
}): Promise<RevertResult> {
  const db = args.supabase ?? createAdminClient();

  const { data: row, error: readErr } = await db
    .from("school_setting_changes")
    .select("id, status, applied_at")
    .eq("id", args.changeId)
    .maybeSingle();

  if (readErr || !row) {
    return {
      ok: false,
      reason: "not_found",
      message: "Setting change not found.",
    };
  }

  if (row.status !== "applied") {
    return {
      ok: false,
      reason: "not_applied",
      message: `Change is ${row.status}, can only revert 'applied' changes.`,
    };
  }

  if (!row.applied_at) {
    return {
      ok: false,
      reason: "not_applied",
      message: "Change has no applied_at timestamp — cannot determine revert window.",
    };
  }

  const appliedAge = Date.now() - new Date(row.applied_at).getTime();
  if (appliedAge > REVERT_WINDOW_MS) {
    return {
      ok: false,
      reason: "outside_revert_window",
      message: "Change is older than 7 days — outside revert window.",
    };
  }

  const revertedAt = new Date();
  const { error: updateErr } = await db
    .from("school_setting_changes")
    .update({
      status: "reverted",
      reverted_at: revertedAt.toISOString(),
      reverted_by_user_id: args.reverterUserId,
    })
    .eq("id", args.changeId)
    .eq("status", "applied"); // optimistic concurrency

  if (updateErr) {
    console.error("[setting-change] revert update failed:", updateErr.message);
    return {
      ok: false,
      reason: "db_error",
      message: "Failed to revert change.",
    };
  }

  return {
    ok: true,
    changeId: args.changeId,
    revertedAt,
  };
}
