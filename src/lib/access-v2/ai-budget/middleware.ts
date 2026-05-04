/**
 * withAIBudget — Phase 5.3 budget-enforcement middleware.
 *
 * Wraps a student-attributed AI call with cascade-resolved cap + atomic
 * counter increment. Returns a 429-shaped failure on over-cap; preserves
 * the wrapped result on success.
 *
 * Flow:
 *   1. resolveStudentCap → effective daily cap.
 *   2. atomic_increment_ai_budget(studentId, 0) — touch + read current
 *      tokens_used_today, zeroing if past horizon.
 *   3. If used >= cap → return { ok: false, reason: 'over_cap' };
 *      throttled audit + warning via last_warning_sent_at.
 *   4. Call fn() — wrapped function returns { result, usage }.
 *   5. Lesson #39 — if usage.stop_reason === 'max_tokens', abort billing
 *      and return { ok: false, reason: 'truncated' }. Don't charge for
 *      a truncated response.
 *   6. atomic_increment_ai_budget(studentId, input + output) — bill.
 *   7. If billed total exceeds cap (the call that crossed) → throttled audit
 *      so admin sees the breach.
 *   8. Return { ok: true, result, cap, remaining }.
 *
 * Routes wire this around any `messages.create` call attributed to a
 * student. The wrapper is the only legitimate path that bills against
 * ai_budget_state — direct INSERT/UPDATE on that table is RLS-blocked
 * (service_role only) AND racy (would let concurrent calls blow past cap).
 *
 * Email notification on over_cap is deferred to
 * FU-AV2-AI-BUDGET-EXHAUSTED-EMAIL P3 — for now the audit_event row
 * (severity 'warn') is the surface admins query.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStudentCap, type CascadeSource } from "./cascade-resolver";
import { logAuditEvent } from "../audit-log";

/**
 * 24-hour throttle window for repeated over_cap warnings on a single student.
 * Only one audit_event ('ai_budget.over_cap') emits per student per window;
 * the actual ai_budget_state.last_warning_sent_at column tracks the last fire.
 */
const WARNING_THROTTLE_MS = 24 * 60 * 60 * 1000;

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  stop_reason: string;
}

export interface FnResult<T> {
  result: T;
  usage: AnthropicUsage;
}

export type WithAIBudgetResult<T> =
  | {
      ok: true;
      result: T;
      cap: number;
      used: number;
      remaining: number;
      source: CascadeSource;
      resetAt: string; // ISO timestamp of next midnight in school's local timezone
    }
  | {
      ok: false;
      reason: "over_cap";
      cap: number;
      used: number;
      resetAt: string;
    }
  | {
      ok: false;
      reason: "truncated";
      cap: number;
      used: number;
      resetAt: string;
    };

export async function withAIBudget<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  studentId: string,
  fn: () => Promise<FnResult<T>>,
): Promise<WithAIBudgetResult<T>> {
  // ── Step 1: cap ──────────────────────────────────────────────────
  const capInfo = await resolveStudentCap(supabase, studentId);
  const cap = capInfo.cap;

  // ── Step 2: touch + read current state via the SQL helper ────────
  // p_tokens=0 = no-op increment; the function still runs the
  // past-horizon zero-and-bump logic so we get fresh state without
  // billing.
  const initial = await callAtomicIncrement(supabase, studentId, 0);
  if (!initial.ok) {
    // Couldn't even read state — fail closed (don't let the AI call
    // proceed un-budgeted).
    return {
      ok: false,
      reason: "over_cap",
      cap,
      used: cap, // unknown; caller treats it as exhausted
      resetAt: new Date().toISOString(),
    };
  }

  // ── Step 3: hard cap check ───────────────────────────────────────
  if (initial.used >= cap) {
    await maybeEmitOverCapWarning(supabase, studentId, capInfo, initial.used);
    return {
      ok: false,
      reason: "over_cap",
      cap,
      used: initial.used,
      resetAt: initial.resetAt,
    };
  }

  // ── Step 4: call wrapped function ────────────────────────────────
  const callResult = await fn();

  // ── Step 5: Lesson #39 truncation guard — don't bill ─────────────
  if (callResult.usage.stop_reason === "max_tokens") {
    return {
      ok: false,
      reason: "truncated",
      cap,
      used: initial.used,
      resetAt: initial.resetAt,
    };
  }

  // ── Step 6: atomic bill ──────────────────────────────────────────
  const totalTokens =
    (callResult.usage.input_tokens || 0) +
    (callResult.usage.output_tokens || 0);
  const final = await callAtomicIncrement(supabase, studentId, totalTokens);

  if (!final.ok) {
    // Billing failed AFTER the AI call succeeded. Surface via Sentry
    // (the AI was used but not billed — skew in cost analytics) and
    // return the result anyway (the user got their response).
    await logAuditEvent(supabase, {
      actorId: studentId,
      actorType: "student",
      action: "ai_budget.bill_failed",
      targetTable: "ai_budget_state",
      targetId: studentId,
      payload: {
        cap,
        billed_tokens: totalTokens,
        stop_reason: callResult.usage.stop_reason,
      },
      severity: "warn",
      failureMode: "soft-sentry",
    });
    return {
      ok: true,
      result: callResult.result,
      cap,
      used: initial.used + totalTokens,
      remaining: Math.max(0, cap - (initial.used + totalTokens)),
      source: capInfo.source,
      resetAt: initial.resetAt,
    };
  }

  // ── Step 7: post-bill over-cap audit (the call that crossed) ────
  if (final.used > cap) {
    await maybeEmitOverCapWarning(supabase, studentId, capInfo, final.used);
  }

  return {
    ok: true,
    result: callResult.result,
    cap,
    used: final.used,
    remaining: Math.max(0, cap - final.used),
    source: capInfo.source,
    resetAt: final.resetAt,
  };
}

// ─────────────────────────────────────────────────────────────────────
// SQL RPC wrapper — calls the SECURITY DEFINER function from §5.2
// ─────────────────────────────────────────────────────────────────────

interface AtomicIncrementResult {
  ok: boolean;
  used: number;
  resetAt: string;
}

async function callAtomicIncrement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  studentId: string,
  tokens: number,
): Promise<AtomicIncrementResult> {
  try {
    const { data, error } = await supabase.rpc("atomic_increment_ai_budget", {
      p_student_id: studentId,
      p_tokens: tokens,
    });
    if (error || !data) {
      return { ok: false, used: 0, resetAt: new Date().toISOString() };
    }
    // The function returns a single-row table — RPC unwraps to an array.
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      used: Number(
        (row as { new_tokens_used_today: number }).new_tokens_used_today,
      ),
      resetAt: String((row as { next_reset_at: string }).next_reset_at),
    };
  } catch {
    return { ok: false, used: 0, resetAt: new Date().toISOString() };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Over-cap warning emit (throttled per student per 24h)
// ─────────────────────────────────────────────────────────────────────

async function maybeEmitOverCapWarning(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  studentId: string,
  capInfo: { cap: number; source: CascadeSource; schoolId: string | null },
  used: number,
): Promise<void> {
  // Throttle check via ai_budget_state.last_warning_sent_at
  let shouldEmit = true;
  try {
    const { data } = await supabase
      .from("ai_budget_state")
      .select("last_warning_sent_at")
      .eq("student_id", studentId)
      .maybeSingle();
    const last = (data as { last_warning_sent_at: string | null } | null)
      ?.last_warning_sent_at;
    if (last) {
      const lastMs = Date.parse(last);
      if (
        Number.isFinite(lastMs) &&
        Date.now() - lastMs < WARNING_THROTTLE_MS
      ) {
        shouldEmit = false;
      }
    }
  } catch {
    // Throttle check failed — emit anyway (better noisy than silent).
  }

  if (!shouldEmit) return;

  // Touch the throttle column. Service-role only (RLS deny-by-default).
  // Failure here doesn't stop the audit emit.
  try {
    await supabase
      .from("ai_budget_state")
      .update({ last_warning_sent_at: new Date().toISOString() })
      .eq("student_id", studentId);
  } catch {
    // ignore — audit_event still emits
  }

  await logAuditEvent(supabase, {
    actorId: studentId,
    actorType: "student",
    action: "ai_budget.over_cap",
    targetTable: "ai_budget_state",
    targetId: studentId,
    schoolId: capInfo.schoolId,
    payload: {
      cap: capInfo.cap,
      used,
      cap_source: capInfo.source,
    },
    severity: "warn",
    failureMode: "soft-sentry",
  });
}
