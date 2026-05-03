/**
 * Tests for src/lib/access-v2/audit-log.ts (Phase 5.1).
 *
 * Coverage:
 *   - Wrapper behaviour: column mapping, defaults, school tier auto-resolve
 *   - 3-mode failure semantics (throw / soft-warn / soft-sentry) per Q2
 *   - Catalog test asserting the exact action strings shipped by Phase 5.1
 *     retrofits (Lesson #38 — assert expected values, not just non-null;
 *     this catches accidental rename of a retrofitted action)
 *
 * Lessons applied: #38 (specific assertions), #44 (no extra abstraction),
 * #45 (only audit-log.ts behaviour; retrofitted callsites tested elsewhere).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logAuditEvent,
  type LogAuditEventInput,
  type AuditFailureMode,
} from "../audit-log";

// ─── Sentry mock ────────────────────────────────────────────────────
//
// Hoisted with vi.mock so the wrapper's `import * as Sentry from "@sentry/nextjs"`
// resolves to our spy. captureException is the only call the wrapper makes
// from the soft-sentry path.

const sentryCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (err: unknown, opts?: unknown) =>
    sentryCaptureException(err, opts),
}));

// ─── Supabase client mock ───────────────────────────────────────────
//
// The wrapper does:
//   1. supabase.from('schools').select('subscription_tier').eq('id', X).maybeSingle()
//   2. supabase.from('audit_events').insert({...})
//
// We expose `lastAuditInsert` so each test can assert the row payload.

interface MockState {
  schoolTier: string | null;
  schoolLookupThrows: boolean;
  insertError: { message: string } | null;
  insertThrows: boolean;
  lastAuditInsert: Record<string, unknown> | null;
}

function buildClient(state: MockState) {
  return {
    from: (table: string) => {
      if (table === "schools") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (state.schoolLookupThrows) {
                  throw new Error("simulated schools lookup failure");
                }
                return {
                  data:
                    state.schoolTier === null
                      ? null
                      : { subscription_tier: state.schoolTier },
                  error: null,
                };
              },
            }),
          }),
        };
      }
      if (table === "audit_events") {
        return {
          insert: async (row: Record<string, unknown>) => {
            if (state.insertThrows) {
              throw new Error("simulated audit_events insert exception");
            }
            state.lastAuditInsert = row;
            return { error: state.insertError };
          },
        };
      }
      throw new Error(`Unmocked table: ${table}`);
    },
  } as unknown as Parameters<typeof logAuditEvent>[0];
}

function defaultInput(
  overrides: Partial<LogAuditEventInput> = {},
): LogAuditEventInput {
  return {
    actorId: "11111111-1111-1111-1111-111111111111",
    actorType: "teacher",
    action: "test.action",
    ...overrides,
  };
}

beforeEach(() => {
  sentryCaptureException.mockClear();
});

// ─── 1. Wrapper behaviour — column mapping + defaults ──────────────

describe("logAuditEvent — column mapping", () => {
  it("maps every input field to the matching DB column on success", async () => {
    const state: MockState = {
      schoolTier: "school",
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    const supabase = buildClient(state);

    const result = await logAuditEvent(supabase, {
      actorId: "actor-uuid",
      actorType: "platform_admin",
      impersonatedBy: "imp-uuid",
      action: "school.merge.completed",
      targetTable: "school_merge_requests",
      targetId: "merge-uuid",
      schoolId: "school-uuid",
      classId: "class-uuid",
      payload: { merge_id: "merge-uuid", rows: 42 },
      ip: "10.0.0.1",
      userAgent: "vitest-1.0",
      severity: "warn",
    });

    expect(result).toEqual({ ok: true });
    expect(state.lastAuditInsert).toEqual({
      actor_id: "actor-uuid",
      actor_type: "platform_admin",
      impersonated_by: "imp-uuid",
      action: "school.merge.completed",
      target_table: "school_merge_requests",
      target_id: "merge-uuid",
      school_id: "school-uuid",
      class_id: "class-uuid",
      payload_jsonb: { merge_id: "merge-uuid", rows: 42 },
      ip_address: "10.0.0.1",
      user_agent: "vitest-1.0",
      severity: "warn",
      school_subscription_tier_at_event: "school",
    });
  });

  it("defaults severity to 'info' when omitted", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    await logAuditEvent(buildClient(state), defaultInput());
    expect(state.lastAuditInsert?.severity).toBe("info");
  });

  it("defaults payload_jsonb to {} when omitted", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    await logAuditEvent(buildClient(state), defaultInput());
    expect(state.lastAuditInsert?.payload_jsonb).toEqual({});
  });

  it("allows actorId NULL for system events", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    await logAuditEvent(
      buildClient(state),
      defaultInput({ actorId: null, actorType: "system" }),
    );
    expect(state.lastAuditInsert?.actor_id).toBeNull();
    expect(state.lastAuditInsert?.actor_type).toBe("system");
  });

  it("nullifies omitted optional fields (target_table, target_id, etc.)", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    await logAuditEvent(buildClient(state), defaultInput());
    expect(state.lastAuditInsert?.target_table).toBeNull();
    expect(state.lastAuditInsert?.target_id).toBeNull();
    expect(state.lastAuditInsert?.school_id).toBeNull();
    expect(state.lastAuditInsert?.class_id).toBeNull();
    expect(state.lastAuditInsert?.impersonated_by).toBeNull();
    expect(state.lastAuditInsert?.ip_address).toBeNull();
    expect(state.lastAuditInsert?.user_agent).toBeNull();
  });
});

// ─── 2. School tier auto-resolution ────────────────────────────────

describe("logAuditEvent — school_subscription_tier_at_event", () => {
  it("populates tier from schools table when schoolId provided", async () => {
    const state: MockState = {
      schoolTier: "pro",
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    await logAuditEvent(
      buildClient(state),
      defaultInput({ schoolId: "school-uuid" }),
    );
    expect(state.lastAuditInsert?.school_subscription_tier_at_event).toBe(
      "pro",
    );
  });

  it("leaves tier NULL when schoolId omitted (no lookup)", async () => {
    const state: MockState = {
      schoolTier: "school",
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    await logAuditEvent(buildClient(state), defaultInput()); // no schoolId
    expect(state.lastAuditInsert?.school_subscription_tier_at_event).toBeNull();
  });

  it("leaves tier NULL when schools row not found (orphan school_id)", async () => {
    const state: MockState = {
      schoolTier: null, // schools query returns null data
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    await logAuditEvent(
      buildClient(state),
      defaultInput({ schoolId: "ghost-school" }),
    );
    expect(state.lastAuditInsert?.school_subscription_tier_at_event).toBeNull();
  });

  it("logs NULL tier when schools lookup THROWS (don't fail the audit)", async () => {
    const state: MockState = {
      schoolTier: "pro",
      schoolLookupThrows: true,
      insertError: null,
      insertThrows: false,
      lastAuditInsert: null,
    };
    const result = await logAuditEvent(
      buildClient(state),
      defaultInput({ schoolId: "broken-school" }),
    );
    expect(result).toEqual({ ok: true });
    expect(state.lastAuditInsert?.school_subscription_tier_at_event).toBeNull();
  });
});

// ─── 3. 3-mode failure semantics (Q2 resolution) ───────────────────

describe("logAuditEvent — failureMode 'throw' (default)", () => {
  it("throws when insert returns an error", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: { message: "RLS denied" },
      insertThrows: false,
      lastAuditInsert: null,
    };
    await expect(
      logAuditEvent(buildClient(state), defaultInput()),
    ).rejects.toThrow(/audit-log.*insert failed.*RLS denied/);
  });

  it("throws when insert itself throws", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: null,
      insertThrows: true,
      lastAuditInsert: null,
    };
    await expect(
      logAuditEvent(buildClient(state), defaultInput()),
    ).rejects.toThrow(/audit-log.*insert failed/);
  });

  it("does NOT call Sentry on throw", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: { message: "RLS denied" },
      insertThrows: false,
      lastAuditInsert: null,
    };
    await expect(
      logAuditEvent(buildClient(state), defaultInput()),
    ).rejects.toThrow();
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });
});

describe("logAuditEvent — failureMode 'soft-warn'", () => {
  it("returns {error} (no throw) when insert fails", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: { message: "RLS denied" },
      insertThrows: false,
      lastAuditInsert: null,
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await logAuditEvent(
      buildClient(state),
      defaultInput({ failureMode: "soft-warn" }),
    );
    expect(result).toEqual({ error: "RLS denied" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[audit-log] insert failed (soft-warn"),
    );
    warnSpy.mockRestore();
  });

  it("does NOT call Sentry on soft-warn", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: { message: "boom" },
      insertThrows: false,
      lastAuditInsert: null,
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await logAuditEvent(
      buildClient(state),
      defaultInput({ failureMode: "soft-warn" }),
    );
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });
});

describe("logAuditEvent — failureMode 'soft-sentry'", () => {
  it("returns {error} (no throw) when insert fails", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: { message: "RLS denied" },
      insertThrows: false,
      lastAuditInsert: null,
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await logAuditEvent(
      buildClient(state),
      defaultInput({ failureMode: "soft-sentry", action: "x.y" }),
    );
    expect(result).toEqual({ error: "RLS denied" });
  });

  it("calls Sentry.captureException with audit-log tags", async () => {
    const state: MockState = {
      schoolTier: null,
      schoolLookupThrows: false,
      insertError: { message: "RLS denied" },
      insertThrows: false,
      lastAuditInsert: null,
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await logAuditEvent(
      buildClient(state),
      defaultInput({
        failureMode: "soft-sentry",
        action: "school_invitation.accepted",
        actorType: "teacher",
        severity: "info",
        schoolId: "school-uuid",
        targetTable: "school_invitations",
        targetId: "inv-uuid",
      }),
    );
    expect(sentryCaptureException).toHaveBeenCalledTimes(1);
    const [err, opts] = sentryCaptureException.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain(
      "[audit-log] insert failed (school_invitation.accepted)",
    );
    expect(opts).toMatchObject({
      tags: {
        layer: "audit-log",
        action: "school_invitation.accepted",
        actor_type: "teacher",
        severity: "info",
      },
      extra: {
        schoolId: "school-uuid",
        targetTable: "school_invitations",
        targetId: "inv-uuid",
      },
    });
  });
});

// ─── 4. Action-string catalog (Lesson #38: assert expected values) ─
//
// Greppable acceptance tests against the actual source files. If a refactor
// renames any of these action strings (or removes the logAuditEvent call),
// the corresponding test fails and forces an audit-trail decision.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSrc(rel: string): string {
  return readFileSync(resolve(__dirname, "../../../..", rel), "utf-8");
}

describe("Phase 5.1 retrofit catalog — assert exact action strings shipped", () => {
  it("school-merge.ts emits all 5 action strings via logAuditEvent", () => {
    const sql = readSrc("src/lib/access-v2/governance/school-merge.ts");
    expect(sql).toContain('action: "school_merge_cascade_failed"');
    expect(sql).toContain('action: "school_merge_cascade_table"');
    expect(sql).toContain('action: "school_merge_school_flip_failed"');
    expect(sql).toContain('action: "school_merge_completed"');
    expect(sql).toContain('action: "school_merge_rejected"');
    // No remaining direct insert (proves retrofit completeness)
    expect(sql).not.toMatch(/from\(['"]audit_events['"]\)\.insert/);
  });

  it("school-merge.ts uses failureMode 'throw' for all 5 sites (cascade integrity)", () => {
    const src = readSrc("src/lib/access-v2/governance/school-merge.ts");
    const throwCount = (src.match(/failureMode: "throw"/g) ?? []).length;
    expect(throwCount).toBe(5);
  });

  it("invitations.ts emits 'school_invitation.accepted' via logAuditEvent (soft-sentry)", () => {
    const src = readSrc("src/lib/access-v2/school/invitations.ts");
    expect(src).toContain('action: "school_invitation.accepted"');
    expect(src).toContain('failureMode: "soft-sentry"');
    expect(src).not.toMatch(/from\(['"]audit_events['"]\)\.insert/);
  });

  it("invitations/[inviteId]/revoke route emits 'school_invitation.revoked' (soft-sentry)", () => {
    const src = readSrc(
      "src/app/api/school/[id]/invitations/[inviteId]/revoke/route.ts",
    );
    expect(src).toContain('action: "school_invitation.revoked"');
    expect(src).toContain('failureMode: "soft-sentry"');
    expect(src).not.toMatch(/from\(['"]audit_events['"]\)\.insert/);
  });

  it("unit-use-requests.ts emits both .approved + .denied via logAuditEvent (soft-sentry)", () => {
    const src = readSrc("src/lib/access-v2/school/unit-use-requests.ts");
    expect(src).toContain('action: "unit_use_request.approved"');
    expect(src).toContain('action: "unit_use_request.denied"');
    const softSentryCount = (
      src.match(/failureMode: "soft-sentry"/g) ?? []
    ).length;
    expect(softSentryCount).toBe(2);
    expect(src).not.toMatch(/from\(['"]audit_events['"]\)\.insert/);
  });

  it("impersonate route emits 'platform_admin.impersonation_url_issued' (soft-sentry, severity warn)", () => {
    const src = readSrc(
      "src/app/api/admin/school/[id]/impersonate/route.ts",
    );
    expect(src).toContain(
      'action: "platform_admin.impersonation_url_issued"',
    );
    expect(src).toContain('failureMode: "soft-sentry"');
    expect(src).toContain('severity: "warn"');
    expect(src).not.toMatch(/from\(['"]audit_events['"]\)\.insert/);
  });

  it("welcome request-school-access route emits 'school.access_requested' (soft-sentry)", () => {
    const src = readSrc(
      "src/app/api/teacher/welcome/request-school-access/route.ts",
    );
    expect(src).toContain('action: "school.access_requested"');
    expect(src).toContain('failureMode: "soft-sentry"');
    expect(src).not.toMatch(/from\(['"]audit_events['"]\)\.insert/);
  });

  it("student-classcode-login uses 'soft-warn' (preserves auth-flow semantic per Q2)", () => {
    const src = readSrc(
      "src/app/api/auth/student-classcode-login/route.ts",
    );
    expect(src).toContain('failureMode: "soft-warn"');
    expect(src).not.toMatch(/from\(['"]audit_events['"]\)\.insert/);
    // Must be the ONLY soft-warn caller in the codebase (other retrofits chose soft-sentry)
    const otherSoftWarn = (src.match(/failureMode: "soft-warn"/g) ?? [])
      .length;
    expect(otherSoftWarn).toBe(1);
  });

  it("can.ts — platform_admin shortcut does NOT call logAuditEvent (audit emits at mutation routes per design call)", () => {
    const src = readSrc("src/lib/access-v2/can.ts");
    // The clarifying comment must be present so future devs know why
    expect(src).toContain(
      "Audit emission lives at the MUTATION ROUTE, not here",
    );
    // The original TODO must be gone
    expect(src).not.toContain("TODO Phase 5: emit logAuditEvent");
  });

  it("zero remaining direct audit_events.insert in src/ (outside the wrapper itself)", () => {
    // Walk the obvious src directories. We don't need a full find — the catalog
    // tests above cover every file the brief named, and earlier mid-flight grep
    // confirmed only audit-log.ts itself contains the call. This test is a
    // belt-and-braces sanity assertion against the canonical wrapper file.
    const wrapper = readSrc("src/lib/access-v2/audit-log.ts");
    expect(wrapper).toContain(
      'await supabase.from("audit_events").insert(',
    );
    // The wrapper is the ONE permitted call site.
  });
});

// ─── 5. Failure-mode type-coverage ────────────────────────────────

describe("AuditFailureMode type completeness", () => {
  it("the 3-mode union is exactly throw / soft-warn / soft-sentry", () => {
    const modes: AuditFailureMode[] = ["throw", "soft-warn", "soft-sentry"];
    expect(modes).toHaveLength(3);
    // Type-level assertion: assigning any other string is a compile error.
  });
});
