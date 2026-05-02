/**
 * Tests for governance tier resolvers.
 *
 * Phase 4.3 per docs/projects/access-model-v2-phase-4-brief.md §3.8 Q2.
 *
 * Resolvers compute SchoolSettingChangeTier from
 * (changeType, payload, actor) — context-aware, not static.
 */

import { describe, it, expect, vi } from "vitest";
import {
  resolveTier,
  __TEST__,
} from "../governance/tier-resolvers";
import type {
  TierResolverContext,
  SchoolSettingChangePayloadV1,
} from "../governance/types";

const ACTOR = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "matt@nis.org.cn",
  isPlatformAdmin: false,
};
const SCHOOL_ID = "22222222-2222-2222-2222-222222222222";

function ctx(
  changeType: string,
  payload: SchoolSettingChangePayloadV1,
  actorOverride?: Partial<typeof ACTOR>
): TierResolverContext {
  return {
    changeType,
    payload,
    actor: { ...ACTOR, ...actorOverride },
    schoolId: SCHOOL_ID,
  };
}

function p<T>(after: T, before?: T, scope?: Record<string, unknown>): SchoolSettingChangePayloadV1<T> {
  return {
    version: 1,
    before_at_propose: (before ?? null) as T,
    after,
    scope,
  };
}

describe("resolveAddSchoolDomain", () => {
  it("LOW when requester email matches the domain being added", async () => {
    const tier = await resolveTier(
      ctx("add_school_domain", p({ domain: "nis.org.cn" }))
    );
    expect(tier).toBe("low_stakes");
  });

  it("HIGH when requester email is on a different domain", async () => {
    const tier = await resolveTier(
      ctx("add_school_domain", p({ domain: "nischina.org" }), {
        email: "matt@nis.org.cn",
      })
    );
    expect(tier).toBe("high_stakes");
  });

  it("case-insensitive comparison", async () => {
    const tier = await resolveTier(
      ctx("add_school_domain", p({ domain: "NIS.ORG.CN" }), {
        email: "matt@nis.org.cn",
      })
    );
    expect(tier).toBe("low_stakes");
  });

  it("HIGH when payload domain is missing or non-string", async () => {
    const tier = await resolveTier(
      ctx("add_school_domain", p({} as { domain?: string }))
    );
    expect(tier).toBe("high_stakes");
  });
});

describe("resolveRemoveSchoolDomain", () => {
  it("ALWAYS high-stakes regardless of payload", async () => {
    const tier = await resolveTier(
      ctx("remove_school_domain", p(null, { domain: "nis.org.cn" }))
    );
    expect(tier).toBe("high_stakes");
  });
});

describe("resolveAiBudget", () => {
  it("LOW when delta is ≤50% of before", async () => {
    // before=100k, after=140k → delta=40k, ratio=0.4 → low
    const tier = await resolveTier(
      ctx("default_student_ai_budget", p(140000, 100000))
    );
    expect(tier).toBe("low_stakes");
  });

  it("HIGH when delta is >50% of before (cost blast radius)", async () => {
    // before=100k, after=160k → delta=60k, ratio=0.6 → high
    const tier = await resolveTier(
      ctx("default_student_ai_budget", p(160000, 100000))
    );
    expect(tier).toBe("high_stakes");
  });

  it("HIGH when before is 0 (first-time settings are baseline-defining)", async () => {
    const tier = await resolveTier(
      ctx("default_student_ai_budget", p(50000, 0))
    );
    expect(tier).toBe("high_stakes");
  });

  it("HIGH when before is null", async () => {
    const tier = await resolveTier(
      ctx("default_student_ai_budget", p(50000, null as unknown as number))
    );
    expect(tier).toBe("high_stakes");
  });

  it("LOW for symmetric decrease within 50% (e.g. 100k → 60k = 40% drop)", async () => {
    const tier = await resolveTier(
      ctx("default_student_ai_budget", p(60000, 100000))
    );
    expect(tier).toBe("low_stakes");
  });

  it("HIGH for symmetric decrease >50% (e.g. 100k → 40k = 60% drop)", async () => {
    const tier = await resolveTier(
      ctx("default_student_ai_budget", p(40000, 100000))
    );
    expect(tier).toBe("high_stakes");
  });
});

describe("ALWAYS_HIGH_STAKES set", () => {
  for (const ct of [
    "school_name",
    "school_logo",
    "school_region",
    "school_country",
    "school_timezone",
    "auth_policy",
    "allowed_auth_modes",
    "remove_teacher",
    "safeguarding_contacts",
    "subscription_tier",
    "delete_lab_with_jobs",
    "audit_log_truncate",
    "approve_school_merge",
  ]) {
    it(`${ct} → high_stakes`, async () => {
      const tier = await resolveTier(ctx(ct, p({ x: 1 })));
      expect(tier).toBe("high_stakes");
    });
  }
});

describe("ALWAYS_LOW_STAKES set", () => {
  for (const ct of [
    "academic_calendar",
    "term_dates",
    "period_bells",
    "period_names",
    "frameworks_in_use",
    "default_grading_scale",
    "machine_list_add",
    "scanner_rule_toggle",
    "ack_default",
    "lab_hours",
    "pickup_sla",
    "fabricator_invite",
    "notification_footer",
    "content_sharing_default",
  ]) {
    it(`${ct} → low_stakes`, async () => {
      const tier = await resolveTier(ctx(ct, p({ x: 1 })));
      expect(tier).toBe("low_stakes");
    });
  }
});

describe("unknown change_type fallback", () => {
  it("defaults to low_stakes with console.warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tier = await resolveTier(ctx("a_change_type_we_did_not_register", p({ x: 1 })));
    expect(tier).toBe("low_stakes");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("a_change_type_we_did_not_register")
    );
    warnSpy.mockRestore();
  });
});

describe("__TEST__ exports surface for ad-hoc inspection", () => {
  it("ALWAYS_HIGH_STAKES contains expected sentinels", () => {
    expect(__TEST__.ALWAYS_HIGH_STAKES.has("school_name")).toBe(true);
    expect(__TEST__.ALWAYS_HIGH_STAKES.has("safeguarding_contacts")).toBe(true);
    expect(__TEST__.ALWAYS_HIGH_STAKES.has("remove_school_domain")).toBe(true);
  });

  it("ALWAYS_LOW_STAKES doesn't overlap with ALWAYS_HIGH_STAKES", () => {
    for (const ct of __TEST__.ALWAYS_LOW_STAKES) {
      expect(__TEST__.ALWAYS_HIGH_STAKES.has(ct)).toBe(false);
    }
  });
});
