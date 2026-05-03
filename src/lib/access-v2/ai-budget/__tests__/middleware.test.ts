/**
 * Tests for src/lib/access-v2/ai-budget/middleware.ts (Phase 5.3).
 *
 * Coverage:
 *   - Happy path: cap not reached → result + remaining
 *   - Pre-check over_cap → 429 shape, fn NOT called
 *   - Truncated (stop_reason='max_tokens') → no bill, failure shape (Lesson #39)
 *   - Bill that crosses cap → ok returned, audit warning emitted
 *   - Audit-warning throttle (24h via last_warning_sent_at)
 *   - bill_failed soft path (rpc returns no row after AI call) → ok returned + Sentry
 *   - Cap source flows through to success result
 *
 * Mocks:
 *   - Supabase client: schools (cascade), ai_budgets, ai_budget_state, students,
 *     class_students, admin_settings, audit_events; rpc('atomic_increment_ai_budget')
 *   - logAuditEvent: spied via vi.mock to assert call shape per Lesson #38
 *   - resolveStudentCap: integrated through the real Supabase mock so the
 *     full cascade behaviour is exercised end-to-end (not double-mocked).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { withAIBudget } from "../middleware";
import { TIER_DEFAULTS } from "../tier-defaults";

// ─── audit-log spy ──────────────────────────────────────────────────

const logAuditEventSpy = vi.fn(async () => ({ ok: true }));
vi.mock("../../audit-log", () => ({
  logAuditEvent: (
    supabase: unknown,
    input: Record<string, unknown>,
  ) => logAuditEventSpy(supabase, input),
}));

// ─── Supabase mock ──────────────────────────────────────────────────

interface MockState {
  // Cascade inputs
  student?: { id: string; school_id: string | null } | null;
  classEnrollments?: Array<{ class_id: string }>;
  budgets?: Array<{
    subject_type: "student" | "class" | "school";
    subject_id: string;
    daily_token_cap: number;
  }>;
  school?: {
    id: string;
    default_student_ai_budget: number | null;
    subscription_tier: string | null;
  } | null;
  adminSettings?: Record<string, unknown>;
  // ai_budget_state
  budgetState?: {
    student_id: string;
    last_warning_sent_at: string | null;
  } | null;
  // RPC
  rpcResults?: Array<{
    new_tokens_used_today: number;
    next_reset_at: string;
  }>; // index 0 = first call (touch+read), index 1 = bill
  rpcThrowAt?: number; // throw on the Nth rpc call
  rpcEmptyAt?: number; // return null/empty data on the Nth rpc call

  // Capture
  rpcCalls?: Array<{ p_student_id: string; p_tokens: number }>;
  warningTouches?: number;
}

function buildClient(state: MockState) {
  state.rpcCalls = [];
  state.warningTouches = 0;
  let rpcCallIndex = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (table: string): any => {
    if (table === "students") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.student ?? null, error: null }),
          }),
        }),
      };
    }
    if (table === "class_students") {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: state.classEnrollments ?? [], error: null }),
        }),
      };
    }
    if (table === "ai_budgets") {
      return {
        select: () => ({
          eq: (_c1: string, val1: string) => ({
            eq: (_c2: string, val2: string) => ({
              maybeSingle: async () => {
                const m = (state.budgets ?? []).find(
                  (b) => b.subject_type === val1 && b.subject_id === val2,
                );
                return {
                  data: m ? { daily_token_cap: m.daily_token_cap } : null,
                  error: null,
                };
              },
            }),
            in: (_c2: string, ids: string[]) => {
              const matches = (state.budgets ?? []).filter(
                (b) => b.subject_type === val1 && ids.includes(b.subject_id),
              );
              return Promise.resolve({
                data: matches.map((m) => ({
                  subject_id: m.subject_id,
                  daily_token_cap: m.daily_token_cap,
                })),
                error: null,
              });
            },
          }),
        }),
      };
    }
    if (table === "schools") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.school ?? null, error: null }),
          }),
        }),
      };
    }
    if (table === "admin_settings") {
      return {
        select: () => ({
          eq: (_col: string, key: string) => ({
            maybeSingle: async () => {
              if (key in (state.adminSettings ?? {})) {
                return {
                  data: { value: (state.adminSettings ?? {})[key] },
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          }),
        }),
      };
    }
    if (table === "ai_budget_state") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.budgetState ?? null, error: null }),
          }),
        }),
        update: () => ({
          eq: async () => {
            state.warningTouches = (state.warningTouches ?? 0) + 1;
            return { error: null };
          },
        }),
      };
    }
    throw new Error(`Unmocked table: ${table}`);
  };

  return {
    from: handler,
    rpc: async (name: string, args: { p_student_id: string; p_tokens: number }) => {
      if (name !== "atomic_increment_ai_budget") {
        throw new Error(`Unmocked rpc: ${name}`);
      }
      state.rpcCalls!.push(args);
      const i = rpcCallIndex++;
      if (state.rpcThrowAt === i) {
        throw new Error("simulated rpc failure");
      }
      if (state.rpcEmptyAt === i) {
        return { data: null, error: null };
      }
      const row = (state.rpcResults ?? [])[i] ?? {
        new_tokens_used_today: 0,
        next_reset_at: "2026-05-04T16:00:00.000Z",
      };
      return { data: [row], error: null };
    },
  } as unknown as Parameters<typeof withAIBudget>[0];
}

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const SCHOOL_ID = "22222222-2222-2222-2222-222222222222";

const HAPPY_PATH_BASE: MockState = {
  student: { id: STUDENT_ID, school_id: SCHOOL_ID },
  classEnrollments: [],
  school: {
    id: SCHOOL_ID,
    default_student_ai_budget: 100_000,
    subscription_tier: "school",
  },
};

beforeEach(() => {
  logAuditEventSpy.mockClear();
});

// ─── Happy path ───────────────────────────────────────────────────

describe("withAIBudget — happy path", () => {
  it("returns ok with result + cap + remaining when under cap", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      rpcResults: [
        { new_tokens_used_today: 5_000, next_reset_at: "2026-05-04T16:00:00.000Z" }, // touch+read
        { new_tokens_used_today: 5_400, next_reset_at: "2026-05-04T16:00:00.000Z" }, // bill (+400)
      ],
    };
    const supabase = buildClient(state);

    const fn = vi.fn(async () => ({
      result: "definition!",
      usage: { input_tokens: 200, output_tokens: 200, stop_reason: "end_turn" },
    }));

    const result = await withAIBudget(supabase, STUDENT_ID, fn);

    expect(result).toEqual({
      ok: true,
      result: "definition!",
      cap: 100_000,
      used: 5_400,
      remaining: 94_600,
      source: "school_default_column",
      resetAt: "2026-05-04T16:00:00.000Z",
    });
    expect(fn).toHaveBeenCalledTimes(1);
    // RPC called twice: once with 0 (touch), once with 400 (bill)
    expect(state.rpcCalls).toEqual([
      { p_student_id: STUDENT_ID, p_tokens: 0 },
      { p_student_id: STUDENT_ID, p_tokens: 400 },
    ]);
    // No audit emitted on happy path
    expect(logAuditEventSpy).not.toHaveBeenCalled();
  });

  it("returns ok with school cap when school override exists", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      budgets: [
        { subject_type: "school", subject_id: SCHOOL_ID, daily_token_cap: 30_000 },
      ],
      rpcResults: [
        { new_tokens_used_today: 0, next_reset_at: "2026-05-04T16:00:00.000Z" },
        { new_tokens_used_today: 250, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
    };
    const supabase = buildClient(state);

    const fn = async () => ({
      result: { foo: "bar" },
      usage: { input_tokens: 100, output_tokens: 150, stop_reason: "end_turn" },
    });

    const result = await withAIBudget(supabase, STUDENT_ID, fn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cap).toBe(30_000);
      expect(result.source).toBe("school");
      expect(result.remaining).toBe(29_750);
    }
  });
});

// ─── Pre-check over_cap ───────────────────────────────────────────

describe("withAIBudget — pre-check over_cap", () => {
  it("returns over_cap WITHOUT calling fn when used >= cap", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      rpcResults: [
        // touch+read returns over-cap state
        { new_tokens_used_today: 100_000, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
    };
    const supabase = buildClient(state);
    const fn = vi.fn();

    const result = await withAIBudget(supabase, STUDENT_ID, fn);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("over_cap");
      expect(result.cap).toBe(100_000);
      expect(result.used).toBe(100_000);
    }
    expect(fn).not.toHaveBeenCalled();
    // Only 1 rpc call (the touch); no billing call
    expect(state.rpcCalls).toHaveLength(1);
  });

  it("emits audit_event severity='warn' on over_cap", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      rpcResults: [
        { new_tokens_used_today: 200_000, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
    };
    const supabase = buildClient(state);
    await withAIBudget(supabase, STUDENT_ID, async () => ({
      result: null,
      usage: { input_tokens: 0, output_tokens: 0, stop_reason: "end_turn" },
    }));

    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
    const [, payload] = logAuditEventSpy.mock.calls[0];
    expect(payload).toMatchObject({
      actorId: STUDENT_ID,
      actorType: "student",
      action: "ai_budget.over_cap",
      targetTable: "ai_budget_state",
      severity: "warn",
      failureMode: "soft-sentry",
    });
    const inputPayload = (payload as { payload: Record<string, unknown> }).payload;
    expect(inputPayload).toMatchObject({
      cap: 100_000,
      used: 200_000,
      cap_source: "school_default_column",
    });
  });
});

// ─── Truncation guard (Lesson #39) ────────────────────────────────

describe("withAIBudget — truncation (Lesson #39)", () => {
  it("returns truncated WITHOUT billing when stop_reason='max_tokens'", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      rpcResults: [
        { new_tokens_used_today: 0, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
    };
    const supabase = buildClient(state);

    const fn = vi.fn(async () => ({
      result: "partial",
      usage: { input_tokens: 100, output_tokens: 300, stop_reason: "max_tokens" },
    }));

    const result = await withAIBudget(supabase, STUDENT_ID, fn);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("truncated");
    }
    expect(fn).toHaveBeenCalledTimes(1);
    // Only 1 rpc call (the touch) — bill was skipped
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls![0].p_tokens).toBe(0);
  });
});

// ─── Bill that crosses cap ────────────────────────────────────────

describe("withAIBudget — bill that crosses cap", () => {
  it("returns ok but emits over_cap warning when post-bill exceeds cap", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      rpcResults: [
        { new_tokens_used_today: 99_500, next_reset_at: "2026-05-04T16:00:00.000Z" }, // touch — under cap
        { new_tokens_used_today: 100_400, next_reset_at: "2026-05-04T16:00:00.000Z" }, // bill — over cap
      ],
    };
    const supabase = buildClient(state);

    const fn = async () => ({
      result: "answer",
      usage: { input_tokens: 400, output_tokens: 500, stop_reason: "end_turn" },
    });

    const result = await withAIBudget(supabase, STUDENT_ID, fn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cap).toBe(100_000);
      expect(result.used).toBe(100_400);
      expect(result.remaining).toBe(0); // clamped to 0, not negative
    }
    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(logAuditEventSpy.mock.calls[0][1]).toMatchObject({
      action: "ai_budget.over_cap",
      severity: "warn",
    });
  });
});

// ─── Throttle ─────────────────────────────────────────────────────

describe("withAIBudget — over_cap audit throttle (24h)", () => {
  it("does NOT emit audit when last_warning_sent_at is < 24h ago", async () => {
    const recentWarning = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      budgetState: {
        student_id: STUDENT_ID,
        last_warning_sent_at: recentWarning,
      },
      rpcResults: [
        { new_tokens_used_today: 100_000, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
    };
    const supabase = buildClient(state);
    await withAIBudget(supabase, STUDENT_ID, async () => ({
      result: null,
      usage: { input_tokens: 0, output_tokens: 0, stop_reason: "end_turn" },
    }));

    expect(logAuditEventSpy).not.toHaveBeenCalled();
    // Throttle column NOT touched (we already alerted recently)
    expect(state.warningTouches).toBe(0);
  });

  it("DOES emit audit when last_warning_sent_at is > 24h ago", async () => {
    const oldWarning = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      budgetState: {
        student_id: STUDENT_ID,
        last_warning_sent_at: oldWarning,
      },
      rpcResults: [
        { new_tokens_used_today: 100_000, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
    };
    const supabase = buildClient(state);
    await withAIBudget(supabase, STUDENT_ID, async () => ({
      result: null,
      usage: { input_tokens: 0, output_tokens: 0, stop_reason: "end_turn" },
    }));

    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
    // Throttle column TOUCHED to record this fire
    expect(state.warningTouches).toBe(1);
  });

  it("DOES emit audit when last_warning_sent_at is NULL (first warning)", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      budgetState: { student_id: STUDENT_ID, last_warning_sent_at: null },
      rpcResults: [
        { new_tokens_used_today: 100_000, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
    };
    const supabase = buildClient(state);
    await withAIBudget(supabase, STUDENT_ID, async () => ({
      result: null,
      usage: { input_tokens: 0, output_tokens: 0, stop_reason: "end_turn" },
    }));

    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(state.warningTouches).toBe(1);
  });
});

// ─── Bill failure soft path ───────────────────────────────────────

describe("withAIBudget — bill_failed (rpc returns empty after AI call)", () => {
  it("returns ok with the AI result + emits Sentry-tagged audit", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      rpcResults: [
        { new_tokens_used_today: 0, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
      rpcEmptyAt: 1, // bill call returns empty
    };
    const supabase = buildClient(state);

    const fn = async () => ({
      result: "answer",
      usage: { input_tokens: 100, output_tokens: 200, stop_reason: "end_turn" },
    });

    const result = await withAIBudget(supabase, STUDENT_ID, fn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toBe("answer");
      // Used falls back to initial.used + total tokens
      expect(result.used).toBe(300);
    }
    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(logAuditEventSpy.mock.calls[0][1]).toMatchObject({
      action: "ai_budget.bill_failed",
      severity: "warn",
      failureMode: "soft-sentry",
    });
  });
});

// ─── Initial state read failure ───────────────────────────────────

describe("withAIBudget — initial rpc failure (fail closed)", () => {
  it("returns over_cap shape when touch+read rpc throws (defensive)", async () => {
    const state: MockState = {
      ...HAPPY_PATH_BASE,
      rpcThrowAt: 0, // touch+read throws
    };
    const supabase = buildClient(state);
    const fn = vi.fn();

    const result = await withAIBudget(supabase, STUDENT_ID, fn);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("over_cap");
    }
    expect(fn).not.toHaveBeenCalled();
  });
});

// ─── Cascade source surfaced ──────────────────────────────────────

describe("withAIBudget — cascade source surfaces in success result", () => {
  it("returns source='tier_default' when no overrides set", async () => {
    const state: MockState = {
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      classEnrollments: [],
      school: {
        id: SCHOOL_ID,
        default_student_ai_budget: null,
        subscription_tier: "free",
      },
      rpcResults: [
        { new_tokens_used_today: 0, next_reset_at: "2026-05-04T16:00:00.000Z" },
        { new_tokens_used_today: 100, next_reset_at: "2026-05-04T16:00:00.000Z" },
      ],
    };
    const supabase = buildClient(state);
    const result = await withAIBudget(supabase, STUDENT_ID, async () => ({
      result: "x",
      usage: { input_tokens: 50, output_tokens: 50, stop_reason: "end_turn" },
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cap).toBe(TIER_DEFAULTS.free);
      expect(result.source).toBe("tier_default");
    }
  });
});
