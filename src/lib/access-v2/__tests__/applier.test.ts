/**
 * Tests for governance applier — Phase 4.4b.
 *
 * The applier maps change_type → actual column update. Called by:
 *   - PATCH /api/school/[id]/settings (low-stakes auto-apply)
 *   - confirm flow (Phase 4.4c — 2nd teacher confirms high-stakes)
 *   - revert flow (Phase 4.4c — write before_at_propose back via applier)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyChange, __TEST__ } from "../governance/applier";

// ─── Mocks ──────────────────────────────────────────────────────────

interface ChainResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

function buildChain(result: ChainResult = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ["update", "insert", "delete", "select", "eq"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as Record<string, ReturnType<typeof vi.fn>> & {
    then: (r: (v: unknown) => void) => Promise<unknown>;
  };
}

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";

let schoolsChain: ReturnType<typeof buildChain>;
let domainsChain: ReturnType<typeof buildChain>;
let mockClient: { from: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  schoolsChain = buildChain({ data: null, error: null, count: 1 });
  domainsChain = buildChain({ data: null, error: null, count: 1 });
  mockClient = {
    from: vi.fn((table: string) => {
      if (table === "schools") return schoolsChain;
      if (table === "school_domains") return domainsChain;
      return buildChain();
    }),
  };
});

// ─── Schools-column appliers ────────────────────────────────────────

describe("applyChange — schools column updates", () => {
  it("school_name → updates schools.name", async () => {
    const result = await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "school_name",
      newValue: "New School Name",
      supabase: mockClient as never,
    });
    expect(result.ok).toBe(true);
    expect(schoolsChain.update).toHaveBeenCalledWith(
      { name: "New School Name" },
      { count: "exact" }
    );
    expect(schoolsChain.eq).toHaveBeenCalledWith("id", SCHOOL_ID);
  });

  it("school_region → updates schools.region", async () => {
    await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "school_region",
      newValue: "asia",
      supabase: mockClient as never,
    });
    expect(schoolsChain.update).toHaveBeenCalledWith(
      { region: "asia" },
      { count: "exact" }
    );
  });

  it("school_timezone → updates schools.timezone", async () => {
    await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "school_timezone",
      newValue: "Australia/Sydney",
      supabase: mockClient as never,
    });
    expect(schoolsChain.update).toHaveBeenCalledWith(
      { timezone: "Australia/Sydney" },
      { count: "exact" }
    );
  });

  it("allowed_auth_modes → updates schools.allowed_auth_modes (array)", async () => {
    await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "allowed_auth_modes",
      newValue: ["email_password", "google"],
      supabase: mockClient as never,
    });
    expect(schoolsChain.update).toHaveBeenCalledWith(
      { allowed_auth_modes: ["email_password", "google"] },
      { count: "exact" }
    );
  });

  it("default_student_ai_budget → updates schools.default_student_ai_budget (int)", async () => {
    await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "default_student_ai_budget",
      newValue: 150000,
      supabase: mockClient as never,
    });
    expect(schoolsChain.update).toHaveBeenCalledWith(
      { default_student_ai_budget: 150000 },
      { count: "exact" }
    );
  });

  it("academic_calendar / term_dates / holidays all map to academic_calendar_jsonb", async () => {
    for (const ct of ["academic_calendar", "term_dates", "holidays"] as const) {
      schoolsChain.update.mockClear();
      await applyChange({
        schoolId: SCHOOL_ID,
        changeType: ct,
        newValue: { terms: [] },
        supabase: mockClient as never,
      });
      expect(schoolsChain.update).toHaveBeenCalledWith(
        { academic_calendar_jsonb: { terms: [] } },
        { count: "exact" }
      );
    }
  });

  it("period_bells / period_names / timetable_skeleton all map to timetable_skeleton_jsonb", async () => {
    for (const ct of [
      "period_bells",
      "period_names",
      "timetable_skeleton",
    ] as const) {
      schoolsChain.update.mockClear();
      await applyChange({
        schoolId: SCHOOL_ID,
        changeType: ct,
        newValue: { periods: 6 },
        supabase: mockClient as never,
      });
      expect(schoolsChain.update).toHaveBeenCalledWith(
        { timetable_skeleton_jsonb: { periods: 6 } },
        { count: "exact" }
      );
    }
  });

  it("safeguarding_contacts → updates safeguarding_contacts_jsonb (array)", async () => {
    await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "safeguarding_contacts",
      newValue: ["safe@nis.org.cn"],
      supabase: mockClient as never,
    });
    expect(schoolsChain.update).toHaveBeenCalledWith(
      { safeguarding_contacts_jsonb: ["safe@nis.org.cn"] },
      { count: "exact" }
    );
  });

  it("returns rowsAffected from count", async () => {
    schoolsChain = buildChain({ data: null, error: null, count: 1 });
    mockClient.from = vi.fn(() => schoolsChain);
    const result = await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "school_name",
      newValue: "X",
      supabase: mockClient as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rowsAffected).toBe(1);
  });

  it("returns db_error when update errors", async () => {
    schoolsChain = buildChain({
      data: null,
      error: { message: "constraint violation" },
    });
    mockClient.from = vi.fn(() => schoolsChain);
    const result = await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "school_name",
      newValue: "X",
      supabase: mockClient as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("db_error");
      expect(result.message).toBe("constraint violation");
    }
  });
});

// ─── Domain appliers ────────────────────────────────────────────────

describe("applyChange — domain operations", () => {
  it("add_school_domain → inserts into school_domains with verified=true (default)", async () => {
    await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "add_school_domain",
      newValue: { domain: "EXAMPLE.ORG", added_by: "user-1" },
      supabase: mockClient as never,
    });
    expect(domainsChain.insert).toHaveBeenCalledWith({
      school_id: SCHOOL_ID,
      domain: "example.org", // lowercased
      verified: true,
      added_by: "user-1",
    });
  });

  it("add_school_domain respects verified=false in payload", async () => {
    await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "add_school_domain",
      newValue: { domain: "example.org", verified: false, added_by: "u" },
      supabase: mockClient as never,
    });
    expect(domainsChain.insert).toHaveBeenCalledWith({
      school_id: SCHOOL_ID,
      domain: "example.org",
      verified: false,
      added_by: "u",
    });
  });

  it("add_school_domain → invalid_payload when domain missing", async () => {
    const result = await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "add_school_domain",
      newValue: { added_by: "u" },
      supabase: mockClient as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_payload");
  });

  it("remove_school_domain → deletes from school_domains by scope.domain_id", async () => {
    await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "remove_school_domain",
      newValue: null,
      scope: { domain_id: "abc-123" },
      supabase: mockClient as never,
    });
    expect(domainsChain.delete).toHaveBeenCalledWith({ count: "exact" });
    expect(domainsChain.eq).toHaveBeenCalledWith("id", "abc-123");
  });

  it("remove_school_domain → invalid_scope when domain_id missing", async () => {
    const result = await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "remove_school_domain",
      newValue: null,
      supabase: mockClient as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_scope");
  });
});

// ─── Unknown change_type ────────────────────────────────────────────

describe("applyChange — unknown change_type", () => {
  it("returns reason='unknown_change_type' for unregistered change_type", async () => {
    const result = await applyChange({
      schoolId: SCHOOL_ID,
      changeType: "totally_unknown_change",
      newValue: "x",
      supabase: mockClient as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unknown_change_type");
      expect(result.message).toContain("totally_unknown_change");
    }
  });
});

// ─── Registry coverage ──────────────────────────────────────────────

describe("APPLIERS registry", () => {
  it("includes all key change_types from tier-resolvers", () => {
    const expected = [
      // Identity
      "school_name",
      "school_region",
      "school_country",
      "school_timezone",
      // Auth
      "allowed_auth_modes",
      // AI / cost
      "subscription_tier",
      "default_student_ai_budget",
      // Calendar / timetable / frameworks
      "academic_calendar",
      "period_bells",
      "frameworks_in_use",
      "default_grading_scale",
      // Branding
      "notification_branding",
      "content_sharing_default",
      // Safeguarding
      "safeguarding_contacts",
      // Domains
      "add_school_domain",
      "remove_school_domain",
    ];
    for (const ct of expected) {
      expect(__TEST__.KNOWN_CHANGE_TYPES).toContain(ct);
    }
  });
});
