/**
 * Rule bucket classifier + submit-gate predicate.
 *
 * Preflight Phase 5-2. Pure helpers shared by the results viewer UI
 * (Phase 5-3) and the submit orchestration (Phase 5-1). No React, no
 * fetch, no DB — every function is deterministic over its inputs.
 *
 * Why extract these:
 * - The UI must show buckets + enable/disable the Submit button based
 *   on the SAME gate logic the server uses on submit. If they drift,
 *   the user gets a "Submit button enabled but server says 400".
 * - submitJob in orchestration.ts had the gate inlined. Phase 5-2
 *   refactors it to call canSubmit so there's a single source of
 *   truth.
 *
 * Severity values are the lowercase strings emitted by the Python
 * worker's scan_results JSONB: "block" | "warn" | "fyi". Anything
 * else is dropped silently (defensive — a future rule category won't
 * break the UI).
 */

// Type-only import keeps rule-buckets circular-dep safe — orchestration
// can import canSubmit directly (next sub-phase wires this) without
// TypeScript complaining about a cycle, since `import type` is erased
// at compile time.
import type { AcknowledgedWarnings, AckChoice } from "./orchestration";

export type Severity = "block" | "warn" | "fyi";

/**
 * Minimal rule shape consumed by the UI + gate. Worker emits more
 * fields (coordinates, face indices) but we only need these for
 * Phase 5-2. Extend as the UI grows.
 */
export interface Rule {
  id: string;
  severity: Severity;
  title?: string;
  explanation?: string;
  fix_hint?: string;
  evidence?: unknown;
}

export interface RuleBuckets {
  /** BLOCK-severity — Submit disabled until cleared (re-upload required). */
  mustFix: Rule[];
  /** WARN-severity — Submit disabled until each has an ack for this revision. */
  shouldFix: Rule[];
  /** FYI-severity — read-only, no gating. */
  fyi: Rule[];
}

/**
 * Split a scan_results rule list into three buckets. Rules with an
 * unrecognised severity are silently dropped — a future rule category
 * ("critical"? "info-plus"?) added to the worker without a client bump
 * shouldn't crash the UI. Worth a log if we add telemetry later.
 */
export function classifyRules(scanResults: { rules?: Rule[] | null }): RuleBuckets {
  const rules = scanResults.rules ?? [];
  const mustFix: Rule[] = [];
  const shouldFix: Rule[] = [];
  const fyi: Rule[] = [];
  for (const rule of rules) {
    switch (rule.severity) {
      case "block":
        mustFix.push(rule);
        break;
      case "warn":
        shouldFix.push(rule);
        break;
      case "fyi":
        fyi.push(rule);
        break;
      default:
        // Unrecognised severity — skip.
        break;
    }
  }
  return { mustFix, shouldFix, fyi };
}

// ============================================================
// canSubmit
// ============================================================

export interface CanSubmitParams {
  /** The scan_results JSONB from the current revision. */
  results: { rules?: Rule[] | null };
  /**
   * Full acknowledged_warnings JSONB from fabrication_jobs. The
   * predicate extracts the relevant revision internally so callers
   * don't have to do the nested-key bookkeeping.
   */
  acknowledgedWarnings: AcknowledgedWarnings | null | undefined;
  /** Which revision to validate acks against — typically current_revision. */
  revisionNumber: number;
}

export type CanSubmitResult =
  | { ok: true }
  | {
      ok: false;
      reason: "blockers_present" | "missing_acks";
      /** Human-readable summary — UI renders verbatim, API forwards to HTTP response. */
      message: string;
      blockerRuleIds?: string[];
      missingAckRuleIds?: string[];
    };

/**
 * The gate: returns `ok: true` if and only if the student is cleared
 * to submit. Otherwise returns a structured failure with enough detail
 * for the UI to highlight the offending rules + the server to return
 * the same error body.
 *
 * Priority order when both conditions fail:
 *   blockers_present > missing_acks
 *
 * Rationale: BLOCKs require a re-upload, not an ack. If both categories
 * fire, the student's next action is "re-upload", not "click more radios".
 */
export function canSubmit(params: CanSubmitParams): CanSubmitResult {
  const { mustFix, shouldFix } = classifyRules(params.results);

  if (mustFix.length > 0) {
    const ids = mustFix.map((r) => r.id);
    return {
      ok: false,
      reason: "blockers_present",
      message: `Must-fix rules still firing: ${ids.join(", ")}. Re-upload a fixed version first.`,
      blockerRuleIds: ids,
    };
  }

  // Extract the ack map for this specific revision. The nested JSONB
  // shape is `{ "revision_<N>": { "<rule_id>": { choice, timestamp } } }`.
  const revisionKey = `revision_${params.revisionNumber}`;
  const acksForRevision = params.acknowledgedWarnings?.[revisionKey] ?? {};

  const missing = shouldFix
    .filter((r) => !acksForRevision[r.id])
    .map((r) => r.id);

  if (missing.length > 0) {
    return {
      ok: false,
      reason: "missing_acks",
      message: `Each warning needs an acknowledgement before submit. Missing: ${missing.join(", ")}`,
      missingAckRuleIds: missing,
    };
  }

  return { ok: true };
}

/**
 * Re-export the AckChoice type for convenience so callers of this
 * module don't have to know it lives in orchestration.ts. Keeps the
 * "Phase 5-2 public surface" self-contained.
 */
export type { AckChoice };
