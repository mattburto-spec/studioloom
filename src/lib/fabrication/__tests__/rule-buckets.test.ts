import { describe, it, expect } from "vitest";
import {
  classifyRules,
  canSubmit,
  type Rule,
} from "../rule-buckets";
import type { AcknowledgedWarnings } from "../orchestration";

/**
 * Phase 5-2 rule-buckets + canSubmit tests.
 *
 * Pure-function coverage. Submit-gate is the single source of truth the
 * results viewer (5-3) and submit endpoint (5-1, refactored this phase)
 * both consume — if the tests drift from behaviour, one consumer will
 * desync from the other. Lesson #38: every assertion checks a specific
 * value, not just truthy.
 */

// ============================================================
// classifyRules
// ============================================================

describe("classifyRules", () => {
  it("returns three empty buckets on an empty rule list", () => {
    expect(classifyRules({ rules: [] })).toEqual({
      mustFix: [],
      shouldFix: [],
      fyi: [],
    });
  });

  it("returns three empty buckets when rules is null (defensive)", () => {
    expect(classifyRules({ rules: null })).toEqual({
      mustFix: [],
      shouldFix: [],
      fyi: [],
    });
  });

  it("returns three empty buckets when rules is missing entirely", () => {
    expect(classifyRules({})).toEqual({ mustFix: [], shouldFix: [], fyi: [] });
  });

  it("routes severity='block' to mustFix only", () => {
    const rules: Rule[] = [
      { id: "R-STL-01", severity: "block", title: "Non-watertight" },
      { id: "R-STL-05", severity: "block", title: "Zero-volume mesh" },
    ];
    const buckets = classifyRules({ rules });
    expect(buckets.mustFix).toHaveLength(2);
    expect(buckets.shouldFix).toHaveLength(0);
    expect(buckets.fyi).toHaveLength(0);
    expect(buckets.mustFix.map((r) => r.id)).toEqual(["R-STL-01", "R-STL-05"]);
  });

  it("routes severity='warn' to shouldFix only", () => {
    const rules: Rule[] = [
      { id: "R-STL-04", severity: "warn", title: "Floating islands" },
    ];
    const buckets = classifyRules({ rules });
    expect(buckets.mustFix).toHaveLength(0);
    expect(buckets.shouldFix).toEqual(rules);
    expect(buckets.fyi).toHaveLength(0);
  });

  it("routes severity='fyi' to fyi only", () => {
    const rules: Rule[] = [
      { id: "R-STL-15", severity: "fyi", title: "Estimated print time" },
      { id: "R-STL-16", severity: "fyi", title: "Estimated filament" },
    ];
    const buckets = classifyRules({ rules });
    expect(buckets.fyi).toEqual(rules);
    expect(buckets.mustFix).toHaveLength(0);
    expect(buckets.shouldFix).toHaveLength(0);
  });

  it("routes a mixed list correctly with stable order within each bucket", () => {
    const rules: Rule[] = [
      { id: "R-STL-15", severity: "fyi", title: "FYI-first" },
      { id: "R-STL-01", severity: "block", title: "Blocker A" },
      { id: "R-STL-04", severity: "warn", title: "Warn A" },
      { id: "R-STL-05", severity: "block", title: "Blocker B" },
      { id: "R-STL-16", severity: "fyi", title: "FYI-second" },
    ];
    const buckets = classifyRules({ rules });
    // Insertion order preserved within each bucket.
    expect(buckets.mustFix.map((r) => r.id)).toEqual(["R-STL-01", "R-STL-05"]);
    expect(buckets.shouldFix.map((r) => r.id)).toEqual(["R-STL-04"]);
    expect(buckets.fyi.map((r) => r.id)).toEqual(["R-STL-15", "R-STL-16"]);
  });

  it("silently drops rules with unrecognised severity (future-compat)", () => {
    const rules = [
      { id: "R-STL-01", severity: "block" as const },
      // @ts-expect-error — testing a future severity category that doesn't exist yet
      { id: "R-FUTURE-99", severity: "critical" },
    ];
    const buckets = classifyRules({ rules: rules as Rule[] });
    expect(buckets.mustFix.map((r) => r.id)).toEqual(["R-STL-01"]);
    expect(buckets.shouldFix).toHaveLength(0);
    expect(buckets.fyi).toHaveLength(0);
  });

  it("preserves all rule properties when bucketing (title, explanation, fix_hint, evidence)", () => {
    const rule: Rule = {
      id: "R-STL-09",
      severity: "block",
      title: "Wall below nozzle × 1.5",
      explanation: "Thin walls won't extrude at 0.4 mm nozzle.",
      fix_hint: "Thicken walls to at least 0.6 mm.",
      evidence: { min_thickness_mm: 0.3, face_count: 24 },
    };
    const buckets = classifyRules({ rules: [rule] });
    expect(buckets.mustFix[0]).toEqual(rule);
  });
});

// ============================================================
// canSubmit
// ============================================================

describe("canSubmit — ok paths", () => {
  it("returns ok:true when no rules fired", () => {
    const r = canSubmit({
      results: { rules: [] },
      acknowledgedWarnings: null,
      revisionNumber: 1,
    });
    expect(r).toEqual({ ok: true });
  });

  it("returns ok:true when only FYI rules fired (no acks needed)", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-15", severity: "fyi" },
          { id: "R-STL-16", severity: "fyi" },
        ],
      },
      acknowledgedWarnings: null,
      revisionNumber: 1,
    });
    expect(r).toEqual({ ok: true });
  });

  it("returns ok:true when every WARN has an ack for this revision", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-04", severity: "warn" },
          { id: "R-STL-11", severity: "warn" },
          { id: "R-STL-15", severity: "fyi" },
        ],
      },
      acknowledgedWarnings: {
        revision_2: {
          "R-STL-04": { choice: "will-fix-slicer", timestamp: "2026-04-22T00:00:00Z" },
          "R-STL-11": { choice: "intentional", timestamp: "2026-04-22T00:00:00Z" },
        },
      },
      revisionNumber: 2,
    });
    expect(r).toEqual({ ok: true });
  });

  it("tolerates undefined acknowledgedWarnings", () => {
    const r = canSubmit({
      results: { rules: [] },
      acknowledgedWarnings: undefined,
      revisionNumber: 1,
    });
    expect(r).toEqual({ ok: true });
  });

  it("tolerates null scan_results.rules", () => {
    const r = canSubmit({
      results: { rules: null },
      acknowledgedWarnings: null,
      revisionNumber: 1,
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("canSubmit — blockers_present path", () => {
  it("returns ok:false with blockerRuleIds + student-readable message when BLOCKs fire", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-01", severity: "block" },
          { id: "R-STL-05", severity: "block" },
        ],
      },
      acknowledgedWarnings: null,
      revisionNumber: 1,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.reason).toBe("blockers_present");
    expect(r.blockerRuleIds).toEqual(["R-STL-01", "R-STL-05"]);
    expect(r.message).toContain("R-STL-01");
    expect(r.message).toContain("R-STL-05");
    expect(r.message).toMatch(/Re-upload a fixed version/);
  });

  it("prioritises blockers_present over missing_acks when both conditions fail", () => {
    // Student has unacknowledged warnings AND a blocker — blocker message wins
    // because the next action is "re-upload", not "click more radios".
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-01", severity: "block" },
          { id: "R-STL-04", severity: "warn" },
        ],
      },
      acknowledgedWarnings: null,
      revisionNumber: 1,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.reason).toBe("blockers_present");
    expect(r.missingAckRuleIds).toBeUndefined();
  });
});

describe("canSubmit — missing_acks path", () => {
  it("returns ok:false with missingAckRuleIds when some WARNs are un-acked", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-04", severity: "warn" },
          { id: "R-STL-11", severity: "warn" },
          { id: "R-STL-14", severity: "warn" },
        ],
      },
      acknowledgedWarnings: {
        revision_1: {
          "R-STL-04": { choice: "acknowledged", timestamp: "2026-04-22T00:00:00Z" },
          // R-STL-11 + R-STL-14 intentionally un-acked
        },
      },
      revisionNumber: 1,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.reason).toBe("missing_acks");
    expect(r.missingAckRuleIds).toEqual(["R-STL-11", "R-STL-14"]);
    expect(r.message).toContain("R-STL-11");
    expect(r.message).toContain("R-STL-14");
    expect(r.message).not.toContain("R-STL-04"); // already acked — excluded
    expect(r.blockerRuleIds).toBeUndefined();
  });

  it("ignores acks from other revisions (revision isolation)", () => {
    const r = canSubmit({
      results: { rules: [{ id: "R-STL-04", severity: "warn" }] },
      acknowledgedWarnings: {
        revision_1: {
          "R-STL-04": { choice: "acknowledged", timestamp: "2026-04-22T00:00:00Z" },
        },
      },
      revisionNumber: 2, // different revision — rev 1 ack doesn't satisfy rev 2
    });
    if (r.ok !== false) throw new Error("expected failure — revision isolation");
    expect(r.missingAckRuleIds).toEqual(["R-STL-04"]);
  });

  it("treats an empty ack map for the current revision as no acks at all", () => {
    const r = canSubmit({
      results: { rules: [{ id: "R-STL-04", severity: "warn" }] },
      acknowledgedWarnings: { revision_1: {} },
      revisionNumber: 1,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.missingAckRuleIds).toEqual(["R-STL-04"]);
  });
});

describe("canSubmit — realistic scenarios", () => {
  it("coaster-orange-unmapped.svg style — 2 FYI rules, no acks needed, auto-pass", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-SVG-04", severity: "fyi", title: "Unmapped stroke color" },
          { id: "R-SVG-15", severity: "fyi", title: "Layer summary" },
        ],
      },
      acknowledgedWarnings: null,
      revisionNumber: 1,
    });
    expect(r).toEqual({ ok: true });
  });

  it("seahorse-not-watertight.stl style — BLOCK + WARN mix, requires re-upload not acks", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-01", severity: "block", title: "Non-watertight" },
          { id: "R-STL-04", severity: "warn", title: "Floating islands" },
          { id: "R-STL-15", severity: "fyi" },
        ],
      },
      acknowledgedWarnings: {
        revision_1: {
          "R-STL-04": { choice: "acknowledged", timestamp: "2026-04-22T00:00:00Z" },
        },
      },
      revisionNumber: 1,
    });
    if (r.ok !== false) throw new Error("expected failure (BLOCK fires)");
    expect(r.reason).toBe("blockers_present");
  });

  it("student fixes the mesh + re-uploads — revision 2 has zero rules fired", () => {
    const r = canSubmit({
      results: { rules: [] },
      acknowledgedWarnings: {
        revision_1: {
          "R-STL-04": { choice: "acknowledged", timestamp: "2026-04-22T00:00:00Z" },
        },
      },
      revisionNumber: 2,
    });
    expect(r).toEqual({ ok: true });
  });
});

// ============================================================
// Regression guard — canSubmit is the submit endpoint's gate
// ============================================================

describe("canSubmit — regression guard for the submit endpoint", () => {
  it("produces the same error shape the Phase 5-1 submit endpoint forwards", () => {
    // If this test ever drifts from submitJob's error mapping, one of the
    // two consumers will produce a different 400 body than the other.
    const r = canSubmit({
      results: { rules: [{ id: "R-STL-04", severity: "warn" }] },
      acknowledgedWarnings: null as unknown as AcknowledgedWarnings,
      revisionNumber: 1,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.message).toMatch(/Missing: R-STL-04/);
  });
});

// ============================================================
// Pilot Mode P1 — overrideBlocks bypass
// ============================================================

describe("canSubmit — Pilot Mode override path", () => {
  it("bypasses BLOCK gate when pilotMode + overrideBlocks both set", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-01", severity: "block", title: "Non-watertight" },
        ],
      },
      acknowledgedWarnings: null,
      revisionNumber: 1,
      pilotMode: true,
      overrideBlocks: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok !== true) throw new Error("expected pass");
    expect(r.pilotOverride).toEqual({ ruleIds: ["R-STL-01"] });
  });

  it("returns ALL block rule ids in pilotOverride.ruleIds, not just the first", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-01", severity: "block" },
          { id: "R-STL-04", severity: "block" },
          { id: "R-STL-05", severity: "block" },
        ],
      },
      acknowledgedWarnings: null,
      revisionNumber: 1,
      pilotMode: true,
      overrideBlocks: true,
    });
    if (r.ok !== true) throw new Error("expected pass");
    expect(r.pilotOverride?.ruleIds).toEqual(["R-STL-01", "R-STL-04", "R-STL-05"]);
  });

  it("does NOT bypass when pilotMode is true but overrideBlocks is false", () => {
    const r = canSubmit({
      results: { rules: [{ id: "R-STL-01", severity: "block" }] },
      acknowledgedWarnings: null,
      revisionNumber: 1,
      pilotMode: true,
      overrideBlocks: false,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.reason).toBe("blockers_present");
    expect(r.blockerRuleIds).toEqual(["R-STL-01"]);
  });

  it("does NOT bypass when overrideBlocks is true but pilotMode is false (server-side flag is closed)", () => {
    const r = canSubmit({
      results: { rules: [{ id: "R-STL-01", severity: "block" }] },
      acknowledgedWarnings: null,
      revisionNumber: 1,
      pilotMode: false,
      overrideBlocks: true,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.reason).toBe("blockers_present");
  });

  it("override does NOT waive WARN acks — student must still acknowledge each warning", () => {
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-01", severity: "block" },
          { id: "R-STL-13", severity: "warn", title: "Flat base" },
        ],
      },
      acknowledgedWarnings: null,
      revisionNumber: 1,
      pilotMode: true,
      overrideBlocks: true,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.reason).toBe("missing_acks");
    expect(r.missingAckRuleIds).toEqual(["R-STL-13"]);
  });

  it("override + WARN acks both present → ok:true with pilotOverride", () => {
    const acks: AcknowledgedWarnings = {
      revision_1: {
        "R-STL-13": { choice: "understood", timestamp: "2026-05-08T10:00:00Z" },
      },
    };
    const r = canSubmit({
      results: {
        rules: [
          { id: "R-STL-01", severity: "block" },
          { id: "R-STL-13", severity: "warn" },
        ],
      },
      acknowledgedWarnings: acks,
      revisionNumber: 1,
      pilotMode: true,
      overrideBlocks: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok !== true) throw new Error("expected pass");
    expect(r.pilotOverride?.ruleIds).toEqual(["R-STL-01"]);
  });

  it("ok:true with no pilotOverride field when no BLOCK rules fire (clean job, override flag irrelevant)", () => {
    const r = canSubmit({
      results: { rules: [] },
      acknowledgedWarnings: null,
      revisionNumber: 1,
      pilotMode: true,
      overrideBlocks: true,
    });
    expect(r).toEqual({ ok: true });
  });

  it("default behaviour (no pilot params) is unchanged — BLOCK rules force re-upload", () => {
    const r = canSubmit({
      results: { rules: [{ id: "R-STL-01", severity: "block" }] },
      acknowledgedWarnings: null,
      revisionNumber: 1,
    });
    if (r.ok !== false) throw new Error("expected failure");
    expect(r.reason).toBe("blockers_present");
  });
});
