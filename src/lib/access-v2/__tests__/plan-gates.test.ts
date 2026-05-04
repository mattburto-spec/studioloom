/**
 * Tests for plan-gate helpers — Phase 4.8b (freemium-build seam).
 *
 * Today both helpers are pass-through (always return ok:true). The
 * freemium build replaces them with real count + cap logic. These
 * tests assert the pass-through contract so any future regression
 * (e.g., a freemium-build PR that breaks the chokepoint integration)
 * is caught at unit-test time.
 */

import { describe, it, expect } from "vitest";
import {
  enforceClassCreateLimit,
  enforceEnrollmentLimit,
  type PlanGateResult,
} from "../plan-gates";

const TEACHER_ID = "11111111-1111-1111-1111-111111111111";
const CLASS_ID = "22222222-2222-2222-2222-222222222222";

describe("enforceClassCreateLimit (pass-through)", () => {
  it("returns ok:true today regardless of teacher", async () => {
    const result = await enforceClassCreateLimit(TEACHER_ID);
    expect(result).toEqual({ ok: true } satisfies PlanGateResult);
  });

  it("doesn't require a supabase client today", async () => {
    // Pass-through means no DB access; freemium build will require it.
    const result = await enforceClassCreateLimit(TEACHER_ID, undefined);
    expect(result.ok).toBe(true);
  });
});

describe("enforceEnrollmentLimit (pass-through)", () => {
  it("returns ok:true today regardless of class", async () => {
    const result = await enforceEnrollmentLimit(CLASS_ID);
    expect(result).toEqual({ ok: true } satisfies PlanGateResult);
  });
});

describe("PlanGateResult shape", () => {
  // These are type-level assertions encoded as runtime tests. They
  // protect the contract callers rely on so the freemium-build PR
  // can't accidentally narrow or change the shape without breaking
  // these tests.
  it("ok:true variant has no other fields required", () => {
    const r: PlanGateResult = { ok: true };
    expect(r.ok).toBe(true);
  });

  it("ok:false variant carries reason + cap + current + tier", () => {
    const r: PlanGateResult = {
      ok: false,
      reason: "plan_limit",
      cap: 1,
      current: 1,
      tier: "free",
    };
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("plan_limit");
      expect(r.cap).toBe(1);
      expect(r.current).toBe(1);
      expect(r.tier).toBe("free");
    }
  });
});
