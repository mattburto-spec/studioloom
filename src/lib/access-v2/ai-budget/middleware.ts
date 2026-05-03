/**
 * SCAFFOLD — Phase 5.3
 *
 * withAIBudget wraps a student-attributed Anthropic call with cascade-resolved
 * token caps + atomic state increment. Returns 429 semantics on cap exceeded.
 *
 * Behaviour:
 *   1. resolveStudentCap → cap + source.
 *   2. Read ai_budget_state.tokens_used_today.
 *   3. If used >= cap → return { ok: false, reason: 'over_cap' };
 *      ALSO emit budget-warning email (throttled via last_warning_sent_at).
 *   4. Call fn(estimateTokens) — fn returns API response.
 *   5. If usage.stop_reason === 'max_tokens' → return { ok: false, reason: 'truncated' }
 *      and DO NOT bill (Lesson #39).
 *   6. atomic_increment_ai_budget(studentId, input+output_tokens) → returns cap_exceeded.
 *   7. If cap_exceeded → emit logAuditEvent (severity 'warn', failureMode 'soft-sentry').
 *   8. Return { ok: true, result, cap, remaining }.
 *
 * Wired into (Phase 5.3):
 *   - src/app/api/student/word-lookup/route.ts
 *   - src/app/api/student/quest/mentor/route.ts
 *   - src/app/api/student/design-assistant/route.ts
 *   - src/app/api/student/safety/check-requirements/route.ts
 *   - any other route surfaced by §5.3d scan-ai-calls.py budget-coverage gate
 */

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  stop_reason: string;
}

export interface FnResult<T> {
  result: T;
  usage: AnthropicUsage;
}

export type WithAIBudgetSuccess<T> = {
  ok: true;
  result: T;
  cap: number;
  remaining: number;
};

export type WithAIBudgetFailure = {
  ok: false;
  reason: "over_cap" | "truncated" | "lookup_failed";
  cap: number;
  used: number;
};

export async function withAIBudget<T>(
  _supabase: unknown,
  _studentId: string,
  _fn: (estimateTokens: (input: string) => number) => Promise<FnResult<T>>,
): Promise<WithAIBudgetSuccess<T> | WithAIBudgetFailure> {
  throw new Error(
    "[scaffold] withAIBudget not implemented — see docs/projects/access-model-v2-phase-5-brief.md §5.3",
  );
}
