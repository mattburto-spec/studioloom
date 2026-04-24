import { describe, it, expect } from "vitest";
import {
  PASSED_STATUSES,
  FAILURE_SEVERITIES,
  countPassed,
  computePassRate,
  computeAvgRevisions,
  computeMedianRevisions,
  computeTopFailureRule,
  buildHistorySummary,
  extractFailingRuleIds,
  formatPassRate,
  formatAvgRevisions,
  fabricationStatusPill,
  type HistoryJob,
} from "../fabrication-history-helpers";

/**
 * Phase 6-4 aggregation tests. Pure functions; the orchestration +
 * API route will call these directly on query results.
 */

function job(partial: Partial<HistoryJob> & { status: string }): HistoryJob {
  return {
    jobId: "j-" + Math.random().toString(36).slice(2, 8),
    currentRevision: 1,
    createdAt: "2026-04-22T12:00:00Z",
    currentRevisionFailingRuleIds: [],
    ...partial,
  };
}

describe("PASSED_STATUSES + FAILURE_SEVERITIES", () => {
  it("treats approved / picked_up / completed as passed", () => {
    expect(PASSED_STATUSES).toContain("approved");
    expect(PASSED_STATUSES).toContain("picked_up");
    expect(PASSED_STATUSES).toContain("completed");
  });
  it("does NOT treat rejected / cancelled / pending as passed", () => {
    expect(PASSED_STATUSES).not.toContain("rejected");
    expect(PASSED_STATUSES).not.toContain("cancelled");
    expect(PASSED_STATUSES).not.toContain("pending_approval");
    expect(PASSED_STATUSES).not.toContain("needs_revision");
  });
  it("fyi is not a failure severity (informational only)", () => {
    expect(FAILURE_SEVERITIES).toEqual(["block", "warn"]);
  });
});

describe("countPassed + computePassRate", () => {
  it("counts passed jobs correctly", () => {
    const jobs = [
      job({ status: "approved" }),
      job({ status: "completed" }),
      job({ status: "picked_up" }),
      job({ status: "rejected" }),
      job({ status: "pending_approval" }),
    ];
    expect(countPassed(jobs)).toBe(3);
    expect(computePassRate(jobs)).toBeCloseTo(3 / 5);
  });
  it("returns 0 for empty list (not NaN)", () => {
    expect(countPassed([])).toBe(0);
    expect(computePassRate([])).toBe(0);
  });
  it("handles all-fail list without crashing", () => {
    const jobs = [
      job({ status: "rejected" }),
      job({ status: "needs_revision" }),
    ];
    expect(computePassRate(jobs)).toBe(0);
  });
  it("handles all-pass list", () => {
    const jobs = [
      job({ status: "approved" }),
      job({ status: "completed" }),
    ];
    expect(computePassRate(jobs)).toBe(1);
  });
});

describe("computeAvgRevisions + computeMedianRevisions", () => {
  it("mean of [1, 2, 3, 4, 10] = 4", () => {
    const jobs = [1, 2, 3, 4, 10].map((n) =>
      job({ status: "approved", currentRevision: n })
    );
    expect(computeAvgRevisions(jobs)).toBe(4);
  });
  it("median of [1, 2, 3, 4, 10] = 3 (not skewed by outlier)", () => {
    const jobs = [1, 2, 3, 4, 10].map((n) =>
      job({ status: "approved", currentRevision: n })
    );
    expect(computeMedianRevisions(jobs)).toBe(3);
  });
  it("median of even-length list = mean of two middles", () => {
    const jobs = [1, 2, 3, 4].map((n) =>
      job({ status: "approved", currentRevision: n })
    );
    expect(computeMedianRevisions(jobs)).toBe(2.5);
  });
  it("both return 0 for empty", () => {
    expect(computeAvgRevisions([])).toBe(0);
    expect(computeMedianRevisions([])).toBe(0);
  });
});

describe("computeTopFailureRule", () => {
  it("returns null for empty / no-failure list", () => {
    expect(computeTopFailureRule([])).toBeNull();
    expect(
      computeTopFailureRule([
        job({ status: "approved", currentRevisionFailingRuleIds: [] }),
      ])
    ).toBeNull();
  });
  it("picks the single most common rule id across jobs", () => {
    const jobs = [
      job({
        status: "approved",
        currentRevisionFailingRuleIds: ["R-STL-01", "R-STL-02"],
      }),
      job({
        status: "approved",
        currentRevisionFailingRuleIds: ["R-STL-01"],
      }),
      job({
        status: "rejected",
        currentRevisionFailingRuleIds: ["R-STL-01", "R-SVG-03"],
      }),
    ];
    const top = computeTopFailureRule(jobs);
    expect(top).not.toBeNull();
    expect(top!.ruleId).toBe("R-STL-01");
    expect(top!.count).toBe(3);
  });
  it("counts a rule once per job when it fires only once on that job's current revision", () => {
    // Rule appears in 2 of 3 jobs' current revisions → count=2.
    const jobs = [
      job({ currentRevisionFailingRuleIds: ["R-X"], status: "approved" }),
      job({ currentRevisionFailingRuleIds: ["R-X"], status: "approved" }),
      job({ currentRevisionFailingRuleIds: ["R-Y"], status: "approved" }),
    ];
    const top = computeTopFailureRule(jobs);
    expect(top).toEqual({ ruleId: "R-X", count: 2 });
  });
});

describe("buildHistorySummary", () => {
  it("aggregates the full metric shape in one call", () => {
    const jobs = [
      job({
        status: "approved",
        currentRevision: 1,
        currentRevisionFailingRuleIds: [],
      }),
      job({
        status: "rejected",
        currentRevision: 3,
        currentRevisionFailingRuleIds: ["R-STL-01", "R-STL-02"],
      }),
      job({
        status: "needs_revision",
        currentRevision: 2,
        currentRevisionFailingRuleIds: ["R-STL-01"],
      }),
    ];
    const summary = buildHistorySummary(jobs);
    expect(summary.totalSubmissions).toBe(3);
    expect(summary.passed).toBe(1);
    expect(summary.passRate).toBeCloseTo(1 / 3);
    expect(summary.avgRevisions).toBeCloseTo(2);
    expect(summary.medianRevisions).toBe(2);
    expect(summary.topFailureRule).toEqual({ ruleId: "R-STL-01", count: 2 });
  });
  it("returns zeroed shape for empty list", () => {
    const summary = buildHistorySummary([]);
    expect(summary).toEqual({
      totalSubmissions: 0,
      passed: 0,
      passRate: 0,
      avgRevisions: 0,
      medianRevisions: 0,
      topFailureRule: null,
    });
  });
});

describe("extractFailingRuleIds", () => {
  it("keeps block + warn, drops fyi", () => {
    const out = extractFailingRuleIds({
      rules: [
        { id: "R-A", severity: "block" },
        { id: "R-B", severity: "warn" },
        { id: "R-C", severity: "fyi" },
      ],
    });
    expect(out).toEqual(["R-A", "R-B"]);
  });
  it("handles null / missing scanResults / missing rules", () => {
    expect(extractFailingRuleIds(null)).toEqual([]);
    expect(extractFailingRuleIds(undefined)).toEqual([]);
    expect(extractFailingRuleIds({ rules: null })).toEqual([]);
    expect(extractFailingRuleIds({ rules: [] })).toEqual([]);
  });
  it("drops rule entries missing id or severity", () => {
    const out = extractFailingRuleIds({
      rules: [
        { id: "R-A", severity: "block" },
        { severity: "block" }, // no id
        { id: "R-C" }, // no severity
      ],
    });
    expect(out).toEqual(["R-A"]);
  });
});

describe("formatPassRate + formatAvgRevisions", () => {
  it("formats a normal pass rate", () => {
    expect(formatPassRate(0.75, 4)).toBe("75%");
    expect(formatPassRate(1, 1)).toBe("100%");
    expect(formatPassRate(0, 3)).toBe("0%");
  });
  it("returns em-dash when no submissions", () => {
    expect(formatPassRate(0, 0)).toBe("—");
  });
  it("formats avg revisions to one decimal", () => {
    expect(formatAvgRevisions(2.333, 3)).toBe("2.3");
    expect(formatAvgRevisions(1, 1)).toBe("1.0");
  });
  it("returns em-dash when no submissions (avg)", () => {
    expect(formatAvgRevisions(0, 0)).toBe("—");
  });
});

// ============================================================
// Phase 7-5d — fabricationStatusPill
// ============================================================
//
// Regression guard for the bug where a failed run (status=completed,
// completion_status=failed) rendered as green "COMPLETED" on list
// views (student /fabrication, teacher per-student + per-class tabs).
// The helper is the single source of truth for pill label + colour.

describe("fabricationStatusPill", () => {
  it("renders completed+printed as green 'PRINTED'", () => {
    const { label, pillClass } = fabricationStatusPill("completed", "printed");
    expect(label).toBe("PRINTED");
    expect(pillClass).toMatch(/bg-green/);
    expect(pillClass).not.toMatch(/bg-red/);
  });

  it("renders completed+cut as green 'CUT'", () => {
    const { label, pillClass } = fabricationStatusPill("completed", "cut");
    expect(label).toBe("CUT");
    expect(pillClass).toMatch(/bg-green/);
  });

  it("renders completed+failed as RED 'RUN FAILED' — the regression this phase fixed", () => {
    const { label, pillClass } = fabricationStatusPill("completed", "failed");
    expect(label).toBe("RUN FAILED");
    expect(pillClass).toMatch(/bg-red/);
    expect(pillClass).not.toMatch(/bg-green/);
  });

  it("treats legacy completed rows (null completion_status) as succeeded (green 'COMPLETED')", () => {
    // Pre-7-5 data exists in prod — no completion_status column writeback
    // happened for jobs completed before the 7-5 deploy. Safe to treat
    // as succeeded; nothing was marked failed before the sub-state shipped.
    const { label, pillClass } = fabricationStatusPill("completed", null);
    expect(label).toBe("COMPLETED");
    expect(pillClass).toMatch(/bg-green/);
  });

  it("renders approved as green APPROVED", () => {
    const { label, pillClass } = fabricationStatusPill("approved", null);
    expect(label).toBe("APPROVED");
    expect(pillClass).toMatch(/bg-green/);
  });

  it("renders pending_approval as amber 'PENDING APPROVAL'", () => {
    const { label, pillClass } = fabricationStatusPill("pending_approval", null);
    expect(label).toBe("PENDING APPROVAL");
    expect(pillClass).toMatch(/bg-amber/);
  });

  it("renders needs_revision as orange 'NEEDS REVISION'", () => {
    const { label, pillClass } = fabricationStatusPill("needs_revision", null);
    expect(label).toBe("NEEDS REVISION");
    expect(pillClass).toMatch(/bg-orange/);
  });

  it("renders rejected as red 'REJECTED'", () => {
    const { label, pillClass } = fabricationStatusPill("rejected", null);
    expect(label).toBe("REJECTED");
    expect(pillClass).toMatch(/bg-red/);
  });

  it("renders picked_up as purple 'IN PROGRESS'", () => {
    const { label, pillClass } = fabricationStatusPill("picked_up", null);
    expect(label).toBe("IN PROGRESS");
    expect(pillClass).toMatch(/bg-purple/);
  });

  it("uppercases + space-separates unknown statuses instead of throwing", () => {
    const { label, pillClass } = fabricationStatusPill("new_fangled_state", null);
    expect(label).toBe("NEW FANGLED STATE");
    expect(pillClass).toMatch(/bg-gray/);
  });

  it("ignores completion_status when status is not 'completed'", () => {
    // Defensive: a rogue completion_status='failed' on a non-terminal
    // status shouldn't turn the approved pill red.
    const { label, pillClass } = fabricationStatusPill("approved", "failed");
    expect(label).toBe("APPROVED");
    expect(pillClass).toMatch(/bg-green/);
  });
});
